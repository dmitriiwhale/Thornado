package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
)

const defaultPortfolioBaseURL = "http://127.0.0.1:3006"

type portfolioProxy struct {
	target *url.URL
	proxy  *httputil.ReverseProxy
}

func newPortfolioProxy() *portfolioProxy {
	baseURL := strings.TrimSpace(os.Getenv("PORTFOLIO_SERVICE_URL"))
	if baseURL == "" {
		baseURL = defaultPortfolioBaseURL
	}
	baseURL = strings.TrimRight(baseURL, "/")

	target, err := url.Parse(baseURL)
	if err != nil || target.Scheme == "" || target.Host == "" {
		target, _ = url.Parse(defaultPortfolioBaseURL)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) {
		http.Error(w, "portfolio service unavailable", http.StatusBadGateway)
	}

	return &portfolioProxy{
		target: target,
		proxy:  proxy,
	}
}

func (p *portfolioProxy) getSnapshot(c echo.Context) error {
	return p.proxyWithSession(c, "/v1/portfolio/snapshot")
}

func (p *portfolioProxy) getWebsocket(c echo.Context) error {
	return p.proxyWithSession(c, "/ws/v1/portfolio")
}

func (p *portfolioProxy) proxyWithSession(c echo.Context, upstreamPath string) error {
	sessionAddress, err := sessionAddressFromContext(c)
	if err != nil {
		return err
	}

	req := c.Request()
	req.Header.Set(executionSessionHeader, sessionAddress)
	req.URL.Path = upstreamPath
	req.URL.RawPath = upstreamPath
	req.Host = p.target.Host

	p.proxy.ServeHTTP(c.Response(), req)
	return nil
}
