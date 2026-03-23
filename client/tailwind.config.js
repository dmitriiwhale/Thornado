/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* Nado app–like tokens (matches portfolio.html class names) */
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          tertiary: '#71717a',
          'button-primary': '#fafafa',
        },
        disabled: '#52525b',
        surface: {
          2: 'rgba(255, 255, 255, 0.06)',
          card: 'rgb(24 24 27 / 0.92)',
        },
        overlay: {
          divider: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.06)',
        },
        primary: '#8b5cf6',
        risk: {
          low: '#22c55e',
          medium: '#eab308',
          extreme: '#ef4444',
        },
      },
      fontSize: {
        '3xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        xs: '0.125rem',
      },
      maxWidth: {
        400: '100rem',
      },
      minWidth: {
        30: '7.5rem',
        32: '8rem',
        36: '9rem',
        42: '10.5rem',
      },
      boxShadow: {
        glow: '0 0 40px rgba(90, 220, 255, 0.18)',
        panel: '0 10px 60px rgba(0, 0, 0, 0.35)',
        'elevation-card': '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}
