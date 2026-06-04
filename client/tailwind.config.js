/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:   '#09122C',
          dark:   '#111827',
          card:   '#1a2235',
          border: '#1f2e47',
          gold:   '#e8b94f',
          blue:   '#3b82f6',
          red:    '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
