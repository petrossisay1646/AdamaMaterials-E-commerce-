/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f6fa',
          100: '#e9edf5',
          200: '#cbd6e8',
          300: '#9fb5d5',
          400: '#6c8ebd',
          500: '#4a6fa5',
          600: '#385685',
          700: '#2e466d',
          800: '#293d5c',
          900: '#263650',
          950: '#192233',
        },
        accent: {
          50: '#fdf8ee',
          100: '#fbf0d5',
          200: '#f6dfaa',
          300: '#f0c774',
          400: '#e8aa44',
          500: '#dd8d23',
          600: '#c5711b',
          700: '#a35518',
          800: '#834219',
          900: '#6b3718',
          950: '#3e1c09',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
