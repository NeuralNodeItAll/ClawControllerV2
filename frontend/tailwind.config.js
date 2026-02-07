/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Liquid Glass palette
        navy: {
          900: '#0B0E17',
          800: '#0F1219',
          700: '#141824',
        },
        glass: {
          card: 'rgba(255, 255, 255, 0.06)',
          'card-hover': 'rgba(255, 255, 255, 0.10)',
          border: 'rgba(255, 255, 255, 0.08)',
          popover: 'rgba(255, 255, 255, 0.15)',
        },
        accent: {
          blue: '#3B82F6',
          green: '#22C55E',
          orange: '#F59E0B',
          red: '#EF4444',
          purple: '#8B5CF6',
          pink: '#EC4899',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        glass: '12px',
        'glass-heavy': '20px',
      },
      borderRadius: {
        glass: '12px',
        'glass-lg': '16px',
        sidebar: '20px',
      },
    },
  },
  plugins: [],
}
