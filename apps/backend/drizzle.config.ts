import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/database-url";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: getDatabaseUrl()
  }
});
