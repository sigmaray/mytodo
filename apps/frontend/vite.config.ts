import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import process from "node:process";

const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": apiTarget,
      "/attachments": apiTarget,
      "/features": apiTarget,
      "/projects": apiTarget,
      "/sections": apiTarget,
      "/settings": {
        target: apiTarget,
        bypass: (request) => request.headers.accept?.includes("text/html") ? request.url : undefined
      },
      "/tasks": apiTarget,
      "/users": apiTarget,
      "/tools-api": apiTarget
    }
  }
});
