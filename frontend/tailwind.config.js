/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        flashGreen: {
          '0%': { backgroundColor: 'rgba(34,197,94,0.35)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(239,68,68,0.35)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        flashGreen: 'flashGreen 0.8s ease-out',
        flashRed: 'flashRed 0.8s ease-out',
      },
    },
  },
  plugins: [],
};
