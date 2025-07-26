/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a103c',
        accent: {
          fuchsia: '#ff00ff',
          cyan: '#00ffff',
          purple: '#8b5cf6',
          green: '#00ff00',
          orange: '#ff8c00',
          red: '#ff0040',
        },
      },
      fontFamily: {
        'body': ['Poppins', 'sans-serif'],
        'heading': ['Orbitron', 'monospace'],
        'pixel': ['Pixelify Sans', 'monospace'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'starfield': 'starfield 20s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        starfield: {
          '0%': { transform: 'translateY(0px)' },
          '100%': { transform: 'translateY(-100vh)' },
        },
      },
    },
  },
  plugins: [],
}