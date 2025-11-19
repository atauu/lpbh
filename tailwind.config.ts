import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#31ab43",
          hover: "#2a9540",
          light: "rgba(49, 171, 67, 0.1)",
          dark: "#1f7a2e",
        },
        background: {
          DEFAULT: "var(--background)",
          secondary: "var(--background-secondary)",
          tertiary: "var(--background-tertiary)",
          hover: "var(--background-hover)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          muted: "var(--text-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
          dark: "var(--border-dark)",
        },
      },
      fontFamily: {
        rye: ["var(--font-rye)", "cursive"],
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        'primary': 'var(--shadow-primary)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
export default config;

