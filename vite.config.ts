import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api/* is proxied to the Express server so the Gemini key never reaches the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
});
