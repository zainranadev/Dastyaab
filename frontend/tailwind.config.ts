import type { Config } from 'tailwindcss';

// Muted Clay / Sandstone (desert floor). Surfaces are sandstone, actions are clay,
// status colours (sage, ochre, rust) are deliberately dusty so nothing shouts.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: { 50: '#F7F1E8', 100: '#EFE5D5', 200: '#E2D2B8', 300: '#D1BB96', 400: '#BC9F74', 500: '#A5865B' },
        clay: { 300: '#CFA08B', 400: '#BA8268', 500: '#A8664F', 600: '#8C5240', 700: '#6E4033', 800: '#523127' },
        ink: '#3A2A22',
        sage: { 100: '#E3E8DA', 600: '#5F6F4F' },
        ochre: { 100: '#F1E3C4', 700: '#8A6320' },
        rust: { 100: '#F0D9D3', 700: '#8A3A2E' },
      },
      fontFamily: {
        serif: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        earth: '0 1px 0 rgba(255,250,240,.7) inset, 0 12px 26px -16px rgba(110,64,51,.45)',
        lift: '0 1px 0 rgba(255,250,240,.7) inset, 0 18px 34px -16px rgba(110,64,51,.55)',
      },
    },
  },
  plugins: [],
} satisfies Config;
