import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /** Загружает преобразование JSX для тестов React-компонентов. */
  plugins: [react()],
  test: {
    /** Предоставляет DOM API для тестов интерфейса. */
    environment: "jsdom",
    /** Устанавливает общие matchers и браузерные заглушки перед тестами. */
    setupFiles: "./src/test/setup.ts",
  },
});
