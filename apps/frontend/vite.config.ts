import process from "node:process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("/node_modules/") ? "vendor" : undefined),
      },
    },
  },
  server: {
    proxy: {
      "/auth": apiTarget,
      "/api/playwright": apiTarget,
      "/attachments": {
        target: apiTarget,
        bypass: (request) => (request.headers.accept?.includes("text/html") ? request.url : undefined),
      },
      "/features": apiTarget,
      "/projects": apiTarget,
      "/sections": apiTarget,
      "/settings": {
        target: apiTarget,
        bypass: (request) => (request.headers.accept?.includes("text/html") ? request.url : undefined),
      },
      "/tasks": apiTarget,
      "/users": apiTarget,
      "/tools-api": apiTarget,
    },
  },
});
