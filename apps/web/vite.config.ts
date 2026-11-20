import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { legalPages } from "./scripts/legal-pages.ts";

const launchMark = readFileSync(
  new URL("../../packages/design/assets/icons/icon-white.svg", import.meta.url),
).toString("base64");

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Adds the About, privacy, terms and support pages, in Arabic and English.
    legalPages(),
    {
      name: "mofied-launch-mark",
      transformIndexHtml: {
        order: "pre",
        handler: (html) =>
          html.replace(
            "__MOFIED_LAUNCH_MARK__",
            `data:image/svg+xml;base64,${launchMark}`,
          ),
      },
    },
  ],
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
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("index.html", import.meta.url)),
      },
    },
  },
});
