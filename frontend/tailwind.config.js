/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b8ccff",
          500: "#3b6cff",
          600: "#2f56d6",
          700: "#2444ad",
          800: "#1d367f",
        },
        ink: {
          900: "#101418",
          800: "#17202a",
          700: "#243142",
        },
        mint: {
          50: "#eafaf3",
          100: "#d2f4e6",
          300: "#72ddb3",
          400: "#36ca92",
          500: "#13b77a",
          600: "#0f9664",
        },
        ember: {
          50: "#fff4e6",
          100: "#ffe2bd",
          200: "#ffc980",
          300: "#ffb252",
          500: "#f59f2f",
          600: "#d97706",
          700: "#a95f04",
          900: "#713f12",
        },
      },
    },
  },
  plugins: [],
};
