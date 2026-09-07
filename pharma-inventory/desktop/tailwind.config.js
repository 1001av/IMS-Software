/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",       // rich slate-900
        subink: "#64748B",    // refined slate-500
        canvas: "#F8FAFC",    // modern soft slate-50 background
        panel: "#FFFFFF",     // pure crisp card surface
        line: "#E2E8F0",      // delicate slate-200 border
        brand: "#059669",     // vibrant agricultural emerald / green
        brandhover: "#047857",
        brandlight: "#ECFDF5",
        warn: "#D97706",      // amber-600
        warnlight: "#FFFBEB",
        danger: "#E11D48",    // rose-600
        dangerlight: "#FFF1F2",
        ok: "#059669",        // emerald-600
        oklight: "#ECFDF5",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)",
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        cardHover: "0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)",
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};
