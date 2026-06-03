import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050711",
          900: "#080b18",
          850: "#0c1022",
          800: "#10172a",
          700: "#1d2942"
        },
        emeraldx: {
          400: "#60a5fa",
          500: "#2563eb",
          600: "#1d4ed8"
        },
        violetrx: {
          400: "#9f7aea",
          500: "#7c3aed"
        },
        cyanx: {
          400: "#38bdf8",
          500: "#0284c7"
        }
      },
      boxShadow: {
        glow: "0 0 60px rgba(37, 99, 235, 0.22)",
        violet: "0 0 70px rgba(124, 58, 237, 0.16)"
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem"
      }
    }
  },
  plugins: []
};

export default config;
