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
          950: "var(--ink-950, #050711)",
          900: "var(--ink-900, #080b18)",
          850: "var(--ink-850, #0c1022)",
          800: "var(--ink-800, #10172a)",
          700: "var(--ink-700, #1d2942)"
        },
        primary: {
          400: "var(--primary-400, #60a5fa)",
          500: "var(--primary-500, #2563eb)",
          600: "var(--primary-600, #1d4ed8)"
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
        "2xl": "0.75rem",
        "3xl": "1rem"
      }
    }
  },
  plugins: []
};

export default config;
