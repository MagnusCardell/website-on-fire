import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./client/index.html",
    "./client/solitaire/index.html",
    "./client/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Solitaire design tokens
        "sol-suit-red": "hsl(var(--sol-suit-red))",
        "sol-suit-black": "hsl(var(--sol-suit-black))",
        "sol-card-face": "hsl(var(--sol-card-face-bg))",
        "sol-card-back-primary": "hsl(var(--sol-card-back-primary))",
        "sol-card-back-secondary": "hsl(var(--sol-card-back-secondary))",
        "sol-card-back-accent": "hsl(var(--sol-card-back-accent))",
        "sol-card-back-border": "hsl(var(--sol-card-back-border))",
        "sol-card-back-highlight": "hsl(var(--sol-card-back-highlight))",
        "sol-pile-foundation-border": "hsl(var(--sol-pile-foundation-border))",
        "sol-pile-foundation-bg": "hsl(var(--sol-pile-foundation-bg))",
        "sol-pile-tableau-border": "hsl(var(--sol-pile-tableau-border))",
        "sol-pile-tableau-bg": "hsl(var(--sol-pile-tableau-bg))",
        "sol-pile-stock-border": "hsl(var(--sol-pile-stock-border))",
        "sol-pile-stock-bg": "hsl(var(--sol-pile-stock-bg))",
        "sol-valid-target": "hsl(var(--sol-valid-target))",
        "sol-selection": "hsl(var(--sol-selection))",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
