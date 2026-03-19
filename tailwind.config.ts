import type { Config } from "tailwindcss";

export default {
  content: ["./src/components/**/*.tsx"],
  prefix: "prc-",
  theme: {
    extend: {
      colors: {
        primary: "var(--prc-primary-color, #2563eb)",
        "primary-hover": "var(--prc-primary-hover, #1d4ed8)",
        surface: "var(--prc-surface-color, #ffffff)",
        "surface-secondary": "var(--prc-surface-secondary, #f3f4f6)",
        "text-primary": "var(--prc-text-primary, #111827)",
        "text-secondary": "var(--prc-text-secondary, #6b7280)",
      },
    },
  },
  plugins: [],
} satisfies Config;
