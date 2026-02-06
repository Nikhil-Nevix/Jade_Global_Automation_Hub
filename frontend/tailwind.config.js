/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EBF5FF',
          100: '#D6EBFF',
          200: '#ADDBFF',
          300: '#75C2FF',
          400: '#3DA3F5',
          500: '#1A7FDB',
          600: '#0D52BD',
          700: '#0A4299',
          800: '#073375',
          900: '#052451',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
      },
      boxShadow: {
        'glow': '0 0 15px rgba(13, 82, 189, 0.3)',
        'glow-sm': '0 0 10px rgba(13, 82, 189, 0.2)',
        'glow-lg': '0 0 25px rgba(13, 82, 189, 0.4)',
        'glow-xl': '0 0 35px rgba(13, 82, 189, 0.5)',
      },
    },
  },
  plugins: [],
}
