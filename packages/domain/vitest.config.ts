import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /** Test pure domain logic in Node.js without a browser environment. */
    environment: "node",
  },
});
