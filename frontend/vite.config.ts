import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only: lets the React app call your FastAPI without changing backend CORS.
// In code we default to VITE_API_URL=/api, so requests go through this proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});





