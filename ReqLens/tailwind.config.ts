import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/ui/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#ffffff',
          subtle: '#f5f5f5',
          border: '#e6e6e6',
        },
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      fontSize: {
        xxs: '11px',
      },
      borderRadius: {
        md2: '10px',
      },
    },
  },
  plugins: [],
} satisfies Config;
