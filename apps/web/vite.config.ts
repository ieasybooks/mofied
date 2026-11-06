import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Local development reaches the same public API without adding localhost
    // to production CORS. Production browsers call Faqieh directly.
    proxy: {
      "/__mofied/session": {
        target: "https://faqieh.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) =>
          path.replace(/^\/__mofied\/session/, "/api/v1/mofied/session"),
      },
    },
  },
  build: { target: "es2022" },
});
