import type { Config } from "tailwindcss";

// The solitaire's styles, read from its own folder only (client/solitaire/solitaire.css
// names this file). Nothing the site adds or removes can change the game's stylesheet.
export default {
  content: [
    "./client/solitaire/index.html",
    "./client/solitaire/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
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
    },
  },
  plugins: [],
} satisfies Config;
