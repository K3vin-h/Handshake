import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// /api/* is proxied to the Express server so the Gemini key never reaches the browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    // changeOrigin:false keeps the browser's Host header, which the account CSRF check (Origin host == Host) needs.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: false } },
  },
});
