/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['DM Serif Display', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
      },
      boxShadow: {
        gallery: '0 2px 8px rgba(0,0,0,0.06)',
        'gallery-hover': '0 4px 16px rgba(0,0,0,0.08)',
        vault: '0 4px 16px rgba(0,0,0,0.5)',
        'vault-hover': '0 8px 32px rgba(0,0,0,0.6)',
        atelier: '0 2px 12px rgba(168,111,60,0.10)',
        'atelier-hover': '0 4px 20px rgba(168,111,60,0.14)',
      },
    },
  },
  plugins: [],
};
