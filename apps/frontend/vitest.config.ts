import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /** Loads JSX transformation for React component tests. */
  plugins: [react()],
  test: {
    /** Provides DOM APIs for interface tests. */
    environment: "jsdom",
    /** Sets up shared matchers and browser mocks before tests. */
    setupFiles: "./src/test/setup.ts",
  },
});
