package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

const maxAvatarBytes = 512 * 1024

// avatarDB is nil when DATABASE_URL is unset — avatar routes degrade gracefully.
var avatarDB *pgxpool.Pool

func initAvatarDB(ctx context.Context) error {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		return nil
	}
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return err
	}
	if err := migrateAvatars(ctx, pool); err != nil {
		pool.Close()
		return err
	}
	avatarDB = pool
	return nil
}

func migrateAvatars(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS user_avatars (
  address TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  image_data BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`)
	return err
}

func getAvatar(c echo.Context) error {
	if avatarDB == nil {
		return echo.NewHTTPError(http.StatusNotFound, "no avatar")
	}
	addr, ok := c.Get("address").(string)
	if !ok || addr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}
	var contentType string
	var imageData []byte
	err := avatarDB.QueryRow(c.Request().Context(),
		`SELECT content_type, image_data FROM user_avatars WHERE address = $1`, addr,
	).Scan(&contentType, &imageData)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "no avatar")
		}
		c.Logger().Error("getAvatar: ", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "database error")
	}
	c.Response().Header().Set("Cache-Control", "private, max-age=300")
	return c.Blob(http.StatusOK, contentType, imageData)
}

func putAvatar(c echo.Context) error {
	if avatarDB == nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "avatar storage not configured")
	}
	addr, ok := c.Get("address").(string)
	if !ok || addr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}
	file, err := c.FormFile("avatar")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "multipart field 'avatar' required")
	}
	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot read file")
	}
	defer src.Close()
	raw, err := io.ReadAll(io.LimitReader(src, maxAvatarBytes+1))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "read failed")
	}
	if len(raw) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "empty file")
	}
	if len(raw) > maxAvatarBytes {
		return echo.NewHTTPError(http.StatusBadRequest, "image too large (max 512KB)")
	}
	ct := http.DetectContentType(raw)
	if !strings.HasPrefix(ct, "image/") {
		return echo.NewHTTPError(http.StatusBadRequest, "must be an image")
	}
	_, err = avatarDB.Exec(c.Request().Context(), `
		INSERT INTO user_avatars (address, content_type, image_data, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (address) DO UPDATE SET
			content_type = EXCLUDED.content_type,
			image_data = EXCLUDED.image_data,
			updated_at = now()
	`, addr, ct, raw)
	if err != nil {
		c.Logger().Error("putAvatar: ", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "could not save avatar")
	}
	return c.NoContent(http.StatusNoContent)
}

func deleteAvatar(c echo.Context) error {
	if avatarDB == nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "avatar storage not configured")
	}
	addr, ok := c.Get("address").(string)
	if !ok || addr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}
	_, err := avatarDB.Exec(c.Request().Context(),
		`DELETE FROM user_avatars WHERE address = $1`, addr)
	if err != nil {
		c.Logger().Error("deleteAvatar: ", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "database error")
	}
	return c.NoContent(http.StatusNoContent)
}
