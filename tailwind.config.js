/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#211f26',
        brand: '#00ace2',
        alert: '#cd4f75',
        safe: '#10b981'
      }
    },
  },
  plugins: [],
}
