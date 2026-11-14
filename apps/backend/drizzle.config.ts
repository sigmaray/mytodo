import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/database-url";

export default defineConfig({
  /** Генерирует SQL для используемой PostgreSQL-базы. */
  dialect: "postgresql",
  /** Описывает таблицы и связи приложения. */
  schema: "./src/db/schema.ts",
  /** Каталог миграций Drizzle. */
  out: "./drizzle",
  dbCredentials: {
    /** Использует единый разбор URL для CLI и сервера. */
    url: getDatabaseUrl(),
  },
});
