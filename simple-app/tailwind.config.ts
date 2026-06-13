import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5rem", /* 8px, buttons (cards use rounded-xl = 12px) */
        md: ".375rem", /* 6px */
        sm: ".25rem", /* 4px */
      },
      colors: {
        // ── Zane design tokens (design elevation pass) ──────────────────
        // Backgrounds: navy-950 hero near-black, navy-900 deep sections,
        // navy-800 card surfaces. paper/ink for light sections.
        // cobalt is THE accent, used sparingly, one accent per viewport.
        navy: {
          950: "#060A14",
          900: "#080E1C",
          800: "#0C1322",
          700: "#1E293B",
        },
        paper: "#FAFAF8",
        ink: "#0B1020",
        // cobalt / cobalt-hover / cobalt-light live in the flat token block
        // below (duplicate object keys would silently override these).
        line: {
          dark: "#1E293B",
          light: "#E2E8F0",
        },
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
        // ── Zane design system tokens ────────────────────────────────────
        // Navy backgrounds
        "navy-bg":       "#080E1C",
        "navy-card":     "#0C1322",
        "navy-elevated": "#111827",
        "navy-surface":  "#1E293B",
        "navy-hover":    "#1A2540",
        // Cobalt action, hover darkens (calmer than the old lighter hover)
        "cobalt":         "#2563EB",
        "cobalt-hover":   "#1D4ED8",
        "cobalt-light":   "#3B82F6",
        "cobalt-pressed": "#1D4ED8",
        "cobalt-subtle":  "#1E3A5F",
        "cobalt-ghost":   "#172B4D",
        // Risk - RED (muted dark)
        "risk-red":        "#B91C1C",
        "risk-red-bg":     "#1F0A0A",
        "risk-red-border": "#450A0A",
        "risk-red-text":   "#FCA5A5",
        // Risk - AMBER (muted dark)
        "risk-amber":        "#B45309",
        "risk-amber-bg":     "#1C0F00",
        "risk-amber-border": "#431407",
        "risk-amber-text":   "#FCD34D",
        // Risk - GREEN (muted dark)
        "risk-green":        "#15803D",
        "risk-green-bg":     "#052E16",
        "risk-green-border": "#14532D",
        "risk-green-text":   "#86EFAC",
        // Risk - GREY
        "risk-grey":        "#475569",
        "risk-grey-bg":     "#0F172A",
        "risk-grey-text":   "#94A3B8",
        // Borders
        "border-subtle":  "#1E293B",
        "border-default": "#334155",
        "border-strong":  "#475569",
        // Text
        "slate-text":      "#F1F5F9",
        "slate-secondary": "#94A3B8",
        "slate-tertiary":  "#64748B",
        "slate-accent":    "#60A5FA",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
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
