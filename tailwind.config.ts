import type { Config } from "tailwindcss";

/**
 * Палитра остаётся «бумажной» (тёплый фон, терракотовый акцент) — это узнаваемо
 * и не выглядит как типовая админка. Добавлены цвета этапов воронки: они несут
 * смысл, а не украшают, поэтому подобраны так, чтобы читались рядом друг с
 * другом и не спорили с терракотовым.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14181f",
        paper: "#f7f6f2",
        accent: "#c8552b",
        accenthover: "#b04723",
        accentsoft: "#e8dfd4",
        // Этапы подбора: от «нашли» к «вышел». Холодные слева, тёплые справа —
        // движение по воронке видно даже боковым зрением.
        stage: {
          longlist: "#5b7c99",
          outreach: "#c8873b",
          interview: "#7a5ea8",
          final: "#3f8f5f",
          rejected: "#9aa0a6",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      transitionTimingFunction: {
        // Встроенные кривые слишком вялые: движение начинается заметно позже
        // нажатия. Эти дают отклик сразу.
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,24,31,0.06), 0 1px 3px rgba(20,24,31,0.04)",
        lift: "0 4px 12px rgba(20,24,31,0.10), 0 2px 4px rgba(20,24,31,0.06)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(0.23, 1, 0.32, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
