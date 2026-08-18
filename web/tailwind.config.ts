import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/client/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      colors: {
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
          light: '#F5F7FA',
          dark: '#0B1220',
        },
      },
      boxShadow: {
        card: '0 10px 28px -14px rgb(0 45 98 / 0.2), 0 2px 10px -4px rgb(15 23 42 / 0.08)',
        'card-hover': '0 18px 40px -16px rgb(0 45 98 / 0.28), 0 8px 18px -8px rgb(197 160 89 / 0.16)',
        '3d': '0 16px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
        glass: '0 24px 56px rgba(0, 0, 0, 0.35), 0 0 28px rgba(197, 160, 89, 0.08)',
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
export default config
