/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1a1a2e',
        paper: '#f8f6f1',
        canvas: '#edeae3',
        accent: '#e63946',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
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

