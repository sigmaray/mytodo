import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/database-url";

export default defineConfig({
  /** Generates SQL for the configured PostgreSQL database. */
  dialect: "postgresql",
  /** Defines the application's tables and relationships. */
  schema: "./src/db/schema.ts",
  /** Drizzle migration directory. */
  out: "./drizzle",
  dbCredentials: {
    /** Uses the same URL parsing logic as the CLI and server. */
    url: getDatabaseUrl(),
  },
});
