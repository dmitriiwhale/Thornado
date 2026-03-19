package main

import (
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()

	e.Use(middleware.CORS())
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.BodyLimit("2M"))

	// API routes
	api := e.Group("/api")
	api.GET("/health", health)
	api.GET("/watchlist", watchlist)

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
