import type { Config } from "tailwindcss";

export default {
  content: ["./src/renderer/index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#090a0f",
          900: "#101218",
          850: "#141720",
          800: "#1b1f2a",
          700: "#2b3140"
        },
        forge: {
          blue: "#75a7ff",
          violet: "#b294ff",
          mint: "#70e0c2",
          amber: "#f0bc68"
        }
      },
      boxShadow: {
        "soft-glow": "0 0 0 1px rgba(117, 167, 255, 0.18), 0 24px 80px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;
