import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        xs: ["0.8125rem", "1.15rem"],
        sm: ["0.9375rem", "1.4rem"],
      },
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        line: "var(--line)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        primary: "var(--primary)",
        "primary-dark": "var(--primary-dark)",
        "primary-soft": "var(--primary-soft)",
        teal: "var(--teal)",
        ok: "var(--ok)",
        "ok-soft": "var(--ok-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
      },
      borderRadius: {
        card: "var(--radius)",
      },
    },
  },
  plugins: [],
};
export default config;
