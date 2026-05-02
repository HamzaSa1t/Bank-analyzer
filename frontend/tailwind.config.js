/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#040817',
          900: '#070b1f',
          800: '#0b1230',
          700: '#111a44',
          600: '#1a2557',
        },
        electric: {
          400: '#3b82ff',
          500: '#1e63ff',
          600: '#0044d9',
        },
        growth: {
          300: '#7afcb1',
          400: '#34e89f',
          500: '#10d181',
          600: '#0aaa68',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        ar: ['Cairo', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 32px 0 rgba(59, 130, 255, 0.35)',
        glowGreen: '0 0 32px 0 rgba(52, 232, 159, 0.35)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,255,0.18), transparent), radial-gradient(ellipse 60% 50% at 80% 110%, rgba(52,232,159,0.12), transparent)',
      },
      keyframes: {
        'pulse-line': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'pulse-line': 'pulse-line 3s ease-in-out infinite',
        'draw-line': 'draw-line 4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
