import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        panel: "var(--surface)",
        ink: "var(--fg)",
        subtle: "var(--muted)",
        line: "var(--border)",
        accent: "var(--accent)",
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
        app: "80rem",
      },
    },
  },
  plugins: [],
};

export default config;
