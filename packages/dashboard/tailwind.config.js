/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        firma: {
          bg: "#09090f",
          "bg-soft": "#0d0d15",
          card: "#111119",
          "card-hover": "#15151f",
          surface: "#161622",
          border: "#1c1c2c",
          "border-light": "#282840",
          accent: "#6366f1",
          "accent-soft": "#818cf8",
          "accent-dim": "#4f46e5",
          green: "#22c55e",
          "green-soft": "#4ade80",
          red: "#ef4444",
          "red-soft": "#f87171",
          yellow: "#eab308",
          "yellow-soft": "#facc15",
          text: "#e2e8f0",
          "text-bright": "#f8fafc",
          muted: "#94a3b8",
          "muted-dark": "#64748b",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-in-up": "fadeInUp 0.6s ease-out",
        "slide-up": "slideUp 0.6s ease-out",
        "slide-up-delay": "slideUp 0.6s ease-out 0.15s both",
        "glow-pulse": "glowPulse 2.5s ease-in-out infinite",
        "flow-right": "flowRight 2.5s linear infinite",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(99, 102, 241, 0.08)" },
          "50%": { boxShadow: "0 0 48px rgba(99, 102, 241, 0.20)" },
        },
        flowRight: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
