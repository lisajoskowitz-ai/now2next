/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A1A2E',
        muted: '#5A5A72',
        violet: '#7C5CFC',
        coral: '#FF6B9D',
        sky: '#4FD1E8',
        canvas: '#FAFAFC',
      },
      boxShadow: {
        surface: '0 18px 45px rgba(57, 45, 111, 0.10)',
        button: '0 12px 25px rgba(124, 92, 252, 0.25)',
      },
    },
  },
  plugins: [],
};
