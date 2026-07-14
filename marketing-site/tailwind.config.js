/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        bg: '#090b0f',
        surface: '#12161f',
        elevated: '#171c27',
        accent: '#e0a34a',
        positive: '#2fb8a0',
        negative: '#e0644f',
        muted: '#a1a1aa',
        hairline: 'rgba(255,255,255,0.06)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        btn: '6px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0,0,0,0.4)',
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.22s ease-out',
        'accordion-up': 'accordion-up 0.22s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
