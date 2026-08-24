import type { Config } from 'tailwindcss';

/**
 * Visual identity: gold on deep ink.
 *
 * The palette is warm and burnished rather than neon — brushed-gold accents on
 * a deep ink ground, with parchment as the light surface. Gold carries the
 * weight in headings, rules, seals and calls to action; it is never used as a
 * flat saturated fill, which is what makes an interface read as "neon" rather
 * than considered.
 *
 * This is an original identity created for this platform. See
 * src/components/brand/Logo.tsx for the mark and how an authorised official
 * asset would replace it.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf9ed',
          100: '#f9efd0',
          200: '#f1dc9d',
          300: '#e8c469',
          400: '#deac42',
          500: '#c9922a',
          600: '#ab7220',
          700: '#89551d',
          800: '#71441f',
          900: '#5f3a1e',
          950: '#361d0d',
        },
        ink: {
          50: '#f5f5f4',
          100: '#e7e6e4',
          200: '#cfcdc9',
          300: '#aca8a2',
          400: '#827d76',
          500: '#67625b',
          600: '#524e48',
          700: '#43403b',
          800: '#2a2825',
          900: '#1c1b19',
          950: '#111110',
        },
        parchment: {
          50: '#fdfcf9',
          100: '#faf7f0',
          200: '#f3ecdd',
          300: '#e9dec5',
          400: '#dbc9a3',
          500: '#c9b183',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 17, 16, 0.05), 0 10px 30px -18px rgba(17, 17, 16, 0.35)',
        gold: '0 0 0 1px rgba(201, 146, 42, 0.35), 0 12px 32px -20px rgba(201, 146, 42, 0.6)',
      },
      backgroundImage: {
        'gold-rule':
          'linear-gradient(90deg, transparent, rgba(201,146,42,0.65) 20%, rgba(232,196,105,0.9) 50%, rgba(201,146,42,0.65) 80%, transparent)',
        'gold-sheen':
          'linear-gradient(135deg, #89551d 0%, #c9922a 35%, #e8c469 50%, #c9922a 65%, #89551d 100%)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'rise-in': 'rise-in 260ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
