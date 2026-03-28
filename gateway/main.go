package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/spruceid/siwe-go"
)

const (
	cookieName     = "thornado_auth"
	nonceTTL       = 10 * time.Minute
	jwtTTL         = 24 * time.Hour
	defaultChainID = 763373 // Nado Ink testnet (fallback if SIWE_CHAIN_IDS unset)
)

type nonceStore struct {
	mu    sync.Mutex
	items map[string]time.Time
}

func newNonceStore() *nonceStore {
	return &nonceStore{items: make(map[string]time.Time)}
}

func (s *nonceStore) put(nonce string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cleanupLocked()
	s.items[nonce] = time.Now().Add(nonceTTL)
}

func (s *nonceStore) take(nonce string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cleanupLocked()
	exp, ok := s.items[nonce]
	if !ok || time.Now().After(exp) {
		return false
	}
	delete(s.items, nonce)
	return true
}

func (s *nonceStore) cleanupLocked() {
	now := time.Now()
	for n, exp := range s.items {
		if now.After(exp) {
			delete(s.items, n)
		}
	}
}

var store = newNonceStore()

type jwtClaims struct {
	Address string `json:"addr"`
	jwt.RegisteredClaims
}

func jwtSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return []byte("dev-only-change-me")
	}
	return []byte(secret)
}

func siweDomain() string {
	d := os.Getenv("SIWE_DOMAIN")
	if d == "" {
		return "localhost:5173"
	}
	return d
}

// allowedChainIDs returns chain IDs permitted in SIWE messages (Ink testnet + mainnet by default).
// Override with SIWE_CHAIN_IDS (comma-separated) or a single SIWE_CHAIN_ID.
func allowedChainIDs() map[int]struct{} {
	s := strings.TrimSpace(os.Getenv("SIWE_CHAIN_IDS"))
	if s == "" {
		s = strings.TrimSpace(os.Getenv("SIWE_CHAIN_ID"))
	}
	if s == "" {
		return map[int]struct{}{
			763373: {}, // inkTestnet
			57073:  {}, // inkMainnet
		}
	}
	out := make(map[int]struct{})
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		n, err := strconv.Atoi(part)
		if err != nil {
			continue
		}
		out[n] = struct{}{}
	}
	if len(out) == 0 {
		return map[int]struct{}{763373: {}, 57073: {}}
	}
	return out
}

func getNonce(c echo.Context) error {
	nonce := siwe.GenerateNonce()
	store.put(nonce)
	return c.JSON(http.StatusOK, map[string]string{"nonce": nonce})
}

type verifyBody struct {
	Message   string `json:"message"`
	Signature string `json:"signature"`
}

func postVerify(c echo.Context) error {
	var body verifyBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid json")
	}
	if body.Message == "" || body.Signature == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "message and signature required")
	}

	msg, err := siwe.ParseMessage(body.Message)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid siwe message")
	}

	if _, ok := allowedChainIDs()[msg.GetChainID()]; !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid chain id")
	}

	domain := siweDomain()
	if msg.GetDomain() != domain {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid domain")
	}

	if !store.take(msg.GetNonce()) {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired nonce")
	}

	nonce := msg.GetNonce()
	_, err = msg.Verify(body.Signature, &domain, &nonce, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "signature verification failed")
	}

	addr := msg.GetAddress()
	token, err := issueJWT(addr.Hex())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "could not issue token")
	}

	setAuthCookie(c, token)
	return c.JSON(http.StatusOK, map[string]string{
		"address": addr.Hex(),
	})
}

func issueJWT(address string) (string, error) {
	claims := jwtClaims{
		Address: strings.ToLower(address),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strings.ToLower(address),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(jwtSecret())
}

func setAuthCookie(c echo.Context, token string) {
	secure := os.Getenv("COOKIE_SECURE") == "1" || os.Getenv("COOKIE_SECURE") == "true"
	c.SetCookie(&http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(jwtTTL.Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearAuthCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func postLogout(c echo.Context) error {
	clearAuthCookie(c)
	return c.NoContent(http.StatusNoContent)
}

func getMe(c echo.Context) error {
	addr, ok := c.Get("address").(string)
	if !ok || addr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}
	return c.JSON(http.StatusOK, map[string]string{"address": addr})
}

func addressFromRequest(c echo.Context) (string, error) {
	cookie, err := c.Cookie(cookieName)
	if err != nil || cookie.Value == "" {
		return "", errors.New("no cookie")
	}
	return parseJWT(cookie.Value)
}

func parseJWT(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwtClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return "", errors.New("invalid token")
	}
	if claims.Subject == "" {
		return "", errors.New("empty subject")
	}
	if !common.IsHexAddress(claims.Subject) {
		return "", errors.New("bad address")
	}
	return strings.ToLower(claims.Subject), nil
}

func requireAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		addr, err := addressFromRequest(c)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
		}
		c.Set("address", addr)
		return next(c)
	}
}

func main() {
	e := echo.New()

	if err := initAvatarDB(context.Background()); err != nil {
		e.Logger.Fatal("avatar database: ", err)
	}
	if avatarDB != nil {
		defer avatarDB.Close()
	}

	allowOrigins := os.Getenv("CORS_ORIGINS")
	if allowOrigins == "" {
		allowOrigins = "http://localhost:5173,http://127.0.0.1:5173"
	}
	origins := strings.Split(allowOrigins, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     origins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.BodyLimit("2M"))

	api := e.Group("/api")
	api.GET("/health", health)
	api.GET("/watchlist", watchlist)

	auth := api.Group("/auth")
	auth.GET("/nonce", getNonce)
	auth.POST("/verify", postVerify)
	auth.POST("/logout", postLogout)
	auth.GET("/me", getMe, requireAuth)

	profile := api.Group("/profile", requireAuth)
	profile.GET("/avatar", getAvatar)
	profile.PUT("/avatar", putAvatar)
	profile.DELETE("/avatar", deleteAvatar)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	e.Logger.Fatal(e.Start(":" + port))
}

func health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"status": "ok",
		"app":    "THORNado server",
	})
}

func watchlist(c echo.Context) error {
	items := []map[string]interface{}{
		{"pair": "BTC-USD", "price": 108442, "change": 2.81},
		{"pair": "ETH-USD", "price": 4182, "change": 1.42},
		{"pair": "SOL-USD", "price": 242, "change": -0.38},
	}
	return c.JSON(http.StatusOK, items)
}
