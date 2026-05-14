/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0a0a0c',
          accent: '#3b82f6', // Base blue, will refine with OKLCH in CSS
          glass: 'rgba(255, 255, 255, 0.05)',
        }
      }
    },
  },
  plugins: [],
}
