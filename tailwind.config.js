/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#3b82f6',
          dark: '#60a5fa',
        },
        background: {
          light: '#f3f4f6',
          dark: '#1f2937',
        },
        card: {
          light: '#ffffff',
          dark: '#374151',
        },
      },
    },
  },
  plugins: [],
};