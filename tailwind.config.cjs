module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0d0d0d",
        accent: "#C0C0C0",
        "background-dark": "#0E0E0E",
        "surface-dark": "#141414",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
  ],
};