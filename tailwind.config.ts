import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#12151c",
        border: "#232734",
        muted: "#8a91a2",
        text: "#e7ebf3",
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
