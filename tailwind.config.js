/** @type {import('tailwindcss').Config} */
// NOTE: In Tailwind v4, configuration is done via CSS @theme, not this file.
// This file is kept for compatibility but design tokens live in src/index.css.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};