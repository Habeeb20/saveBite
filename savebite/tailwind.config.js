/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#F97316", tint: "#FFEDD5" },
        money: { DEFAULT: "#16A34A", light: "#22C55E", tint: "#DCFCE7" },
        cream: "#FFFBF5",
      },
    },
  },
  plugins: [],
};