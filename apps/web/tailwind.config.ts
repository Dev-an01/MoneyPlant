import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MoneyPlant design tokens (warm paper + botanical green + clay)
        paper: "#EFE9DD",
        card: "#F6F2EA",
        field: "#FBF8F1",
        line: "#E2D9C8",
        "line-soft": "#E9E1D2",
        ink: "#1C1A16",
        "ink-soft": "#2C2922",
        muted: "#9C9280",
        "muted-2": "#6B6358",
        faint: "#A89E8B",
        brand: {
          DEFAULT: "#2E5D45",
          dark: "#244A37",
          mid: "#7B9B6E",
        },
        gain: "#2F7A4F",
        "gain-light": "#7BC894",
        clay: {
          DEFAULT: "#B06A2C",
          light: "#C68A3A",
          deep: "#A06628",
        },
        danger: { DEFAULT: "#B23B36", dark: "#9A302C" },
        "neutral-fill": "#E5DDCF",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-franklin)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "mp-pulse": { "0%,100%": { opacity: "0.45" }, "50%": { opacity: "1" } },
        "mp-shimmer": {
          "0%": { backgroundPosition: "-360px 0" },
          "100%": { backgroundPosition: "360px 0" },
        },
        "mp-rise": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "mp-toast": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "mp-pulse": "mp-pulse 1.6s infinite",
        "mp-rise": "mp-rise 0.4s ease both",
        "mp-toast": "mp-toast 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
