import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /** Backend-тесты работают в Node.js и не нуждаются в браузерном DOM. */
    environment: "node",
  },
});
