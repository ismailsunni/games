/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        sm: '0 1px 2px rgb(22 24 43 / 0.06)',
        md: '0 4px 14px -2px rgb(22 24 43 / 0.08), 0 2px 4px -2px rgb(22 24 43 / 0.06)',
        lg: '0 12px 32px -8px rgb(22 24 43 / 0.16), 0 4px 8px -4px rgb(22 24 43 / 0.06)',
      },
      keyframes: {
        dealIn: {
          '0%':   { opacity: '0', transform: 'translateY(-18px) scale(0.85)' },
          '100%': { opacity: '1', transform: 'translateY(0)      scale(1)'   },
        },
        discardOut: {
          '0%':   { opacity: '1', transform: 'translateY(0)    scale(1)'    },
          '100%': { opacity: '0', transform: 'translateY(14px) scale(0.85)' },
        },
        flipIn: {
          '0%':   { opacity: '0.3', transform: 'rotateY(90deg) scale(0.9)' },
          '100%': { opacity: '1',   transform: 'rotateY(0deg)  scale(1)'   },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
      },
      animation: {
        'deal-in':     'dealIn 0.22s ease-out both',
        'discard-out': 'discardOut 0.18s ease-in both',
        'flip-in':     'flipIn 0.2s ease-out both',
        'slide-up':    'slideUp 0.18s ease-out both',
      },
    },
  },
  plugins: [],
}

