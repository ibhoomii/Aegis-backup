import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F6F4EF",
          dim: "#EFECE3",
        },
        ink: {
          DEFAULT: "#12151A",
          soft: "#454B52",
          faint: "#7A8087",
        },
        void: {
          DEFAULT: "#0A0C0E",
          surface: "#14171B",
          raised: "#1B1F24",
        },
        line: {
          DEFAULT: "#DEDACD",
          dark: "#262B31",
        },
        signal: {
          DEFAULT: "#E8471C",
          dim: "#C93E18",
          soft: "#FBE4DA",
        },
        clearance: {
          DEFAULT: "#0E8F6B",
          soft: "#DBF0E7",
        },
        caution: {
          DEFAULT: "#DB9A1E",
          soft: "#F7E9CC",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontWeight: {
        "400": "400",
        "500": "500",
        "600": "600",
        "700": "700",
      },
      letterSpacing: {
        tightest: "-0.045em",
        tighter: "-0.03em",
        wideish: "0.08em",
        widest2: "0.22em",
      },
      backgroundImage: {
        "grid-light":
          "linear-gradient(to right, #DEDACD 1px, transparent 1px), linear-gradient(to bottom, #DEDACD 1px, transparent 1px)",
        "grid-dark":
          "linear-gradient(to right, #262B31 1px, transparent 1px), linear-gradient(to bottom, #262B31 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "42px 42px",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.15" },
        },
        "converge-1": {
          "0%": { transform: "translate(0, 0) rotate(0deg)", opacity: "1" },
          "60%": { opacity: "1" },
          "100%": {
            transform: "translate(var(--tx), var(--ty)) rotate(0deg)",
            opacity: "0",
          },
        },
      },
      animation: {
        marquee: "marquee 32s linear infinite",
        "scan-line": "scan-line 3.2s ease-in-out infinite",
        blink: "blink 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
