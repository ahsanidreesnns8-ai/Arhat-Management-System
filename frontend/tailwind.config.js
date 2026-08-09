/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'Fraunces', 'serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      colors: {
        // Brand: Rehmani navy + metallic gold
        primary: {
          DEFAULT: '#002D62',
          dark: '#3B6FA8',
          50: '#EEF4FB',
          100: '#D9E6F5',
          500: '#0A3A75',
          600: '#002D62',
          700: '#001F45',
        },
        accent: {
          DEFAULT: '#C5A059',
          50: '#FBF6EA',
          500: '#E8C87A',
          600: '#C5A059',
        },
        surface: {
          light: '#F7F8FA',
          dark: '#0B1220',
        },
      },
      boxShadow: {
        card: '0 8px 24px -12px rgb(0 45 98 / 0.18), 0 2px 8px -4px rgb(15 23 42 / 0.08)',
        'card-hover': '0 18px 40px -16px rgb(0 45 98 / 0.28), 0 8px 16px -8px rgb(15 23 42 / 0.12)',
        '3d': '0 12px 28px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.55)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        shimmer: 'shimmer 1.5s infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
