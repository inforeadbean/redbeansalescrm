/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // RBH brand palette — a deep "red bean" red on near-white. Use these
        // tokens instead of raw hex so a future rebrand is a one-line change
        // here. NOTE: this is the *identity* colour only — semantic status
        // colours (green = success / on-target, amber = at-risk, red-600 =
        // destructive) stay as Tailwind's own scales and are not brand red.
        primary: {
          DEFAULT: "#C1121F",
          light: "#FDE7E9",
          dark: "#8A0F19",
        },
        surface: "#FBF7F7",
      },
    },
  },
  plugins: [],
};
