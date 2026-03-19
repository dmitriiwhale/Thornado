/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 40px rgba(90, 220, 255, 0.18)',
        panel: '0 10px 60px rgba(0, 0, 0, 0.35)'
      }
    }
  },
  plugins: []
}
