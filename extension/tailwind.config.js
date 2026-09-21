/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{ts,tsx}",
      "./*.{ts,tsx}"
    ],
    theme: {
      extend: {
        colors: {
          chocolate: {
            DEFAULT: "#2A1810",
            50: "#4D2E22",
            100: "#3D2317",
            200: "#2A1810",
            300: "#1A0F0A",
            400: "#5E3D2E",
            500: "#6F4E3D",
          },
          "butter-yellow": {
            DEFAULT: "#FFF3B0",
            50: "#FFFDF0",
            100: "#FFF8D4",
            200: "#FFF3B0",
            300: "#FFE680",
            400: "#FFD94D",
            500: "#FFC71A",
            dark: "#1A0F0A",
          },
          "ice-blue": {
            DEFAULT: "#A2CFFE",
            50: "#EAF3FF",
            100: "#D1E7FF",
            200: "#A2CFFE",
            300: "#73B7FD",
            400: "#449FFC",
            500: "#1587FB",
          },
          cream: {
            DEFAULT: "#FAF6EE",
            100: "#FDFBF7",
            200: "#FAF6EE",
            300: "#F0E8D8",
          },
        },
      },
    },
    plugins: [],
  };