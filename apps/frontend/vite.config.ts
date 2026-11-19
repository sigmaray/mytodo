import process from "node:process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Backend address used by the frontend development server proxy. */
const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  /** Enables JSX transformation and React Fast Refresh. */
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /** Bundles node_modules dependencies into a shared vendor chunk. */
        manualChunks: (id) => (id.includes("/node_modules/") ? "vendor" : undefined),
      },
    },
  },
  server: {
    proxy: {
      /** Routes application requests to the backend during development. */
      "/auth": apiTarget,
      "/api/playwright": apiTarget,
      "/attachments": {
        target: apiTarget,
        /** Leaves frontend HTML navigation to the dev server while proxying API requests. */
        bypass: (request) => (request.headers.accept?.includes("text/html") ? request.url : undefined),
      },
      "/features": apiTarget,
      "/projects": apiTarget,
      "/sections": apiTarget,
      "/settings": {
        target: apiTarget,
        /** Does not proxy browser document requests with `accept: text/html` to the API. */
        bypass: (request) => (request.headers.accept?.includes("text/html") ? request.url : undefined),
      },
      "/tasks": apiTarget,
      "/users": apiTarget,
      "/tools-api": apiTarget,
    },
  },
});
