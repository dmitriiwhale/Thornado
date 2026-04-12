import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001'
const chartProxyTarget = process.env.VITE_CHART_PROXY_TARGET || 'http://127.0.0.1:3004'
const marketsProxyTarget = process.env.VITE_MARKETS_PROXY_TARGET || 'http://127.0.0.1:3005'
const orderbookProxyTarget = process.env.VITE_ORDERBOOK_PROXY_TARGET || 'http://127.0.0.1:3002'

function normalizeHost(value = '') {
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

const allowedHosts = Array.from(
  new Set(
    [
      'localhost',
      '127.0.0.1',
      ...(process.env.VITE_ALLOWED_HOSTS || '')
        .split(',')
        .map(normalizeHost)
        .filter(Boolean),
      normalizeHost(process.env.VITE_SIWE_DOMAIN || ''),
    ].filter(Boolean),
  ),
)

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          animation: ['framer-motion', 'gsap'],
          splittext: ['gsap/ScrollTrigger', 'gsap/SplitText', 'gsap/ScrambleTextPlugin'],
          grid: ['react-grid-layout', 'react-resizable'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
      '/v1/candles': {
        target: chartProxyTarget,
        changeOrigin: true,
      },
      '/ws/v1/candles': {
        target: chartProxyTarget,
        changeOrigin: true,
        ws: true,
      },
      '/markets/snapshot': {
        target: marketsProxyTarget,
        changeOrigin: true,
      },
      '/symbols': {
        target: marketsProxyTarget,
        changeOrigin: true,
      },
      '/ws/v1/markets': {
        target: marketsProxyTarget,
        changeOrigin: true,
        ws: true,
      },
      '/ws/v1/orderbook': {
        target: orderbookProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
