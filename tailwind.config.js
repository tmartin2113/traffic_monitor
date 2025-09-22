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
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        severity: {
          severe: '#dc2626',
          major: '#ea580c',
          moderate: '#f59e0b',
          minor: '#3b82f6',
          unknown: '#6b7280',
        },
        event: {
          construction: '#f59e0b',
          incident: '#dc2626',
          special: '#8b5cf6',
          road: '#0ea5e9',
          weather: '#06b6d4',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'marker': '0 2px 8px rgba(0,0,0,0.3)',
        'panel': '0 4px 20px rgba(0,0,0,0.1)',
      },
      zIndex: {
        'map': '1',
        'controls': '1000',
        'panel': '1001',
        'modal': '2000',
        'tooltip': '3000',
        'notification': '4000',
      },
      screens: {
        'xs': '475px',
      },
      minHeight: {
        'panel': '200px',
      },
      maxHeight: {
        'panel': '80vh',
        'list': '60vh',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
