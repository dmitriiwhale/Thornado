import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    host: '0.0.0.0'
  }
})
