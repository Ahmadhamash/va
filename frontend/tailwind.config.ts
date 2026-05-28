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
        // Semantic Colors mapped to CSS Variables
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        "surface-hover": "var(--bg-surface-hover)",
        glass: "var(--glass-bg)",
        
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        
        border: "var(--border-default)",
        "border-focus": "var(--border-focus)",
        
        brand: {
          DEFAULT: "var(--brand-primary)",
          hover: "var(--brand-primary-hover)",
          accent: "var(--brand-accent)",
        },
        
        // Legacy Hardcoded Colors (kept for safe fallback during transition)
        ink: {
          950: "#050711",
          900: "#080b18",
          850: "#0c1022",
          800: "#10172a",
          700: "#1d2942"
        },
        emeraldx: {
          400: "#42f5b0",
          500: "#10d28e",
          600: "#0aac74"
        },
        violetrx: {
          400: "#9f7aea",
          500: "#7c3aed"
        },
        cyanx: {
          400: "#5ee7ff",
          500: "#22c7e8"
        }
      },
      boxShadow: {
        glow: "0 0 60px rgba(16, 210, 142, 0.18)",
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
