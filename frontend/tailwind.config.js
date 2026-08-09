/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      colors: {
        // Brand navy + metallic gold (identity)
        primary: {
          DEFAULT: '#2563EB',
          dark: '#60A5FA',
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        accent: {
          DEFAULT: '#A78BFA',
          50: '#F5F3FF',
          500: '#A78BFA',
          600: '#8B5CF6',
        },
        glow: {
          cyan: '#22D3EE',
          blue: '#38BDF8',
          violet: '#8B5CF6',
        },
        surface: {
          light: '#F4F7FB',
          dark: '#0A0E17',
        },
        void: '#0A0E17',
      },
      boxShadow: {
        card: '0 8px 28px -12px rgb(37 99 235 / 0.18), 0 2px 10px -4px rgb(15 23 42 / 0.08)',
        'card-hover': '0 20px 48px -16px rgb(56 189 248 / 0.28), 0 8px 20px -8px rgb(139 92 246 / 0.18)',
        '3d': '0 16px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
        glass: '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(99, 102, 241, 0.12)',
        glow: '0 0 32px rgba(56, 189, 248, 0.35), 0 0 60px rgba(139, 92, 246, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        shimmer: 'shimmer 1.5s infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.8s ease-in-out infinite',
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
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(56,189,248,0.25)' },
          '50%': { boxShadow: '0 0 36px rgba(139,92,246,0.45)' },
        },
      },
    },
  },
  plugins: [],
}
