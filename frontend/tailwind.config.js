/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#143456',
        muted: '#5C6D80',
        violet: '#6D64B8',
        coral: '#A96E94',
        sky: '#5DB7B0',
        canvas: '#F7F9FB',
      },
      boxShadow: {
        surface: '0 12px 32px rgba(20, 52, 86, 0.08)',
        button: '0 8px 18px rgba(31, 62, 116, 0.20)',
      },
    },
  },
  plugins: [],
};
