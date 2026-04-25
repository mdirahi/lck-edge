import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Keep in sync with CSS variables in src/app/globals.css
        bg: "#0a0c11",
        "bg-elev": "#11141c",
        panel: "#141823",
        "panel-lift": "#171c28",
        border: "#262b3a",
        "border-soft": "#1c2030",
        muted: "#9aa3b8",
        text: "#edf1f9",
        accent: "#6aa9ff",
        "accent-2": "#b69bff",
        good: "#3ed39a",
        warn: "#f1b63d",
        bad: "#f06e5b",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.02) inset, 0 10px 30px -14px rgba(0,0,0,0.55)",
        hero: "0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -18px rgba(0,0,0,0.7), 0 0 0 1px rgba(106,169,255,0.04)",
        glow: "0 6px 22px -8px rgba(106,169,255,0.6), 0 0 0 1px rgba(106,169,255,0.2) inset",
      },
    },
  },
  plugins: [],
} satisfies Config;
