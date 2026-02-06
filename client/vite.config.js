import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      // Let the React app call `/ip` without CORS hassles in dev.
      "/ip": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  }
});