import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /** Backend tests run in Node.js and do not require a browser DOM. */
    environment: "node",
  },
});
