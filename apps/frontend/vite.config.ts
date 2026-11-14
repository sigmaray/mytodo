import process from "node:process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Адрес backend для прокси frontend dev-сервера. */
const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  /** Включает преобразование JSX и Fast Refresh для React. */
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /** Собирает зависимости node_modules в общий vendor chunk. */
        manualChunks: (id) => (id.includes("/node_modules/") ? "vendor" : undefined),
      },
    },
  },
  server: {
    proxy: {
      /** Направляет запросы приложения к backend во время разработки. */
      "/auth": apiTarget,
      "/api/playwright": apiTarget,
      "/attachments": {
        target: apiTarget,
        /** Оставляет HTML-навигацию frontend dev-серверу, проксируя API-запросы. */
        bypass: (request) => (request.headers.accept?.includes("text/html") ? request.url : undefined),
      },
      "/features": apiTarget,
      "/projects": apiTarget,
      "/sections": apiTarget,
      "/settings": {
        target: apiTarget,
        /** Не перенаправляет запросы документов браузера с accept: text/html в API. */
        bypass: (request) => (request.headers.accept?.includes("text/html") ? request.url : undefined),
      },
      "/tasks": apiTarget,
      "/users": apiTarget,
      "/tools-api": apiTarget,
    },
  },
});
