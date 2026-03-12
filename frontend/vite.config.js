import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API requests to FastAPI so we avoid CORS issues during development
    proxy: {
      "/generate-course": "http://localhost:8000",
      "/health":           "http://localhost:8000",
    },
  },
});
