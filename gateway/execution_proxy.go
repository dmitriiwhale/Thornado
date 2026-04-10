package main

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

const (
	executionSessionHeader  = "X-Thornado-Session-Address"
	defaultExecutionBaseURL = "http://127.0.0.1:3003"
)

type executionProxy struct {
	baseURL string
	client  *http.Client
}

func newExecutionProxy() *executionProxy {
	baseURL := strings.TrimSpace(os.Getenv("EXECUTION_SERVICE_URL"))
	if baseURL == "" {
		baseURL = defaultExecutionBaseURL
	}
	baseURL = strings.TrimRight(baseURL, "/")

	return &executionProxy{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (p *executionProxy) postExecute(c echo.Context) error {
	return p.proxy(c, http.MethodPost, "/v1/execute", c.Request().Body)
}

func (p *executionProxy) postExecuteTrigger(c echo.Context) error {
	return p.proxy(c, http.MethodPost, "/v1/execute/trigger", c.Request().Body)
}

func (p *executionProxy) getCapabilities(c echo.Context) error {
	return p.proxy(c, http.MethodGet, "/v1/capabilities", nil)
}

func (p *executionProxy) getContext(c echo.Context) error {
	return p.proxyContext(c)
}

func (p *executionProxy) getProfileContext(c echo.Context) error {
	return p.proxyContext(c)
}

func (p *executionProxy) proxyContext(c echo.Context) error {
	sessionAddress, err := sessionAddressFromContext(c)
	if err != nil {
		return err
	}

	query := url.Values{}
	query.Set("owner", sessionAddress)
	if subaccountName := strings.TrimSpace(c.QueryParam("subaccount_name")); subaccountName != "" {
		query.Set("subaccount_name", subaccountName)
	}

	path := "/v1/context?" + query.Encode()
	return p.proxyWithSession(c, http.MethodGet, path, nil, sessionAddress)
}

func (p *executionProxy) proxy(c echo.Context, method, path string, body io.Reader) error {
	sessionAddress, err := sessionAddressFromContext(c)
	if err != nil {
		return err
	}
	return p.proxyWithSession(c, method, path, body, sessionAddress)
}

func (p *executionProxy) proxyWithSession(
	c echo.Context,
	method string,
	path string,
	body io.Reader,
	sessionAddress string,
) error {
	upstreamURL := p.baseURL + path
	req, err := http.NewRequestWithContext(c.Request().Context(), method, upstreamURL, body)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to build execution request")
	}

	req.Header.Set(executionSessionHeader, sessionAddress)
	if contentType := c.Request().Header.Get(echo.HeaderContentType); contentType != "" {
		req.Header.Set(echo.HeaderContentType, contentType)
	}
	if accept := c.Request().Header.Get(echo.HeaderAccept); accept != "" {
		req.Header.Set(echo.HeaderAccept, accept)
	} else {
		req.Header.Set(echo.HeaderAccept, "application/json")
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "execution service unavailable")
	}
	defer resp.Body.Close()

	if contentType := resp.Header.Get(echo.HeaderContentType); contentType != "" {
		c.Response().Header().Set(echo.HeaderContentType, contentType)
	}

	c.Response().WriteHeader(resp.StatusCode)
	if _, err := io.Copy(c.Response().Writer, resp.Body); err != nil {
		return err
	}

	return nil
}

func sessionAddressFromContext(c echo.Context) (string, error) {
	addr, ok := c.Get("address").(string)
	if !ok || strings.TrimSpace(addr) == "" {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}
	return strings.ToLower(strings.TrimSpace(addr)), nil
}
