import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /** Проверяет чистую доменную логику в Node.js без браузерного окружения. */
    environment: "node",
  },
});
