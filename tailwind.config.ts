import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        panel: "var(--surface)",
        raised: "var(--surface-raised)",
        ink: "var(--fg)",
        subtle: "var(--muted)",
        faint: "var(--fg-faint)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-fg)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      maxWidth: {
        app: "90rem",
      },
    },
  },
  plugins: [],
};

export default config;
