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
        border: "#262b3a",
        "border-soft": "#1c2030",
        muted: "#9aa3b8",
        text: "#edf1f9",
        accent: "#6aa9ff",
        good: "#3ed39a",
        warn: "#f1b63d",
        bad: "#f06e5b"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"]
      }
    }
  },
  plugins: []
} satisfies Config;
