import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import postgres from "postgres";
import { z } from "zod";

const tableSchema = z.object({
  table: z.string().trim().min(1)
});

const querySchema = z.object({
  sql: z.string().trim().min(1)
});

const tableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (name: string) => {
  if (!tableNamePattern.test(name)) {
    throw new Error("Invalid table name");
  }

  return `"${name}"`;
};

const migrationFiles = Object.freeze([
  new URL("../drizzle/0000_create_tasks.sql", import.meta.url),
  new URL("../drizzle/0001_settings_auth.sql", import.meta.url),
  new URL("../drizzle/0002_task_details_archives.sql", import.meta.url),
  new URL("../drizzle/0003_remove_task_priorities.sql", import.meta.url),
  new URL("../drizzle/0004_scope_descriptions.sql", import.meta.url),
  new URL("../drizzle/0005_project_hierarchy.sql", import.meta.url),
  new URL("../drizzle/0006_users.sql", import.meta.url),
  new URL("../drizzle/0007_task_comments.sql", import.meta.url),
  new URL("../drizzle/0008_data_integrity.sql", import.meta.url)
]);
const protectedTables = Object.freeze(["sessions", "users"]);

const seedTasks = Object.freeze([
  Object.freeze({
    id: "seed-inbox",
    title: "Review seeded task",
    parentId: null,
    lexicalOrder: "U"
  }),
  Object.freeze({
    id: "seed-child",
    title: "Nested seeded task",
    parentId: "seed-inbox",
    lexicalOrder: "U"
  })
]);

const parseJson = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};

const listTables = async (sql: postgres.Sql) =>
  sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

const clearTable = async (sql: postgres.Sql, table: string) => {
  if (protectedTables.includes(table)) {
    throw new Error("Application settings and session tables cannot be cleared from Tools");
  }

  await sql.unsafe(`TRUNCATE TABLE ${quoteIdentifier(table)} RESTART IDENTITY CASCADE`);

  return Object.freeze({ table });
};

const clearAllTables = async (sql: postgres.Sql) => {
  const tables = (await listTables(sql)).filter((table) => !protectedTables.includes(table.table_name));

  await Promise.all(tables.map((table) => clearTable(sql, table.table_name)));

  return Object.freeze({ tables: Object.freeze(tables.map((table) => table.table_name)) });
};

const dropAllTables = async (sql: postgres.Sql) => {
  await sql`
    DO $$
    DECLARE item RECORD;
    BEGIN
      FOR item IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = current_schema()
          AND tablename NOT IN ('sessions', 'users')
      ) LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', item.tablename);
      END LOOP;
    END $$;
  `;
};

const migrate = async (sql: postgres.Sql) => {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(await readFile(migrationFile, "utf8"));
  }
};

const seed = async (sql: postgres.Sql) => {
  await migrate(sql);
  await Promise.all(
    seedTasks.map((task) =>
      sql`
        INSERT INTO tasks (id, user_id, title, completed, parent_id, lexical_order)
        VALUES (${task.id}, 'legacy-admin', ${task.title}, false, ${task.parentId}, ${task.lexicalOrder})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          user_id = EXCLUDED.user_id,
          completed = EXCLUDED.completed,
          parent_id = EXCLUDED.parent_id,
          lexical_order = EXCLUDED.lexical_order,
          updated_at = now()
      `
    )
  );

  return Object.freeze({ inserted: seedTasks.length });
};

export const createToolsRouter = (databaseUrl: string, mode: string) => {
  const router = new Hono();
  const enabled = mode !== "production";
  const sql = postgres(databaseUrl, { max: 1 });

  router.use("*", async (context, next) => {
    if (!enabled) {
      return context.json({ error: "Tools are disabled" }, 404);
    }

    return next();
  });

  router.get("/tables", async (context) => {
    const tables = await listTables(sql);

    return context.json({ tables: tables.map((table) => table.table_name) });
  });

  router.get("/records/:table", async (context) => {
    const table = context.req.param("table");
    const limitParam = context.req.query("limit") ?? "10";
    const limit = limitParam === "all" ? null : Number(limitParam);
    const tables = await listTables(sql);
    if (!tableNamePattern.test(table) || !tables.some((item) => item.table_name === table)) return context.json({ error: "Unknown table" }, 404);
    if (limit !== null && limit !== 10 && limit !== 100) return context.json({ error: "Limit must be 10, 100, or all" }, 400);
    const columns = await sql<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ${table}`;
    const orderColumn = columns.some((column) => column.column_name === "created_at") ? "created_at" : columns.some((column) => column.column_name === "id") ? "id" : null;
    const ordering = orderColumn === null ? "" : ` ORDER BY ${quoteIdentifier(orderColumn)} DESC`;
    const limitClause = limit === null ? "" : ` LIMIT ${limit}`;
    const rows = await sql.unsafe(`SELECT * FROM ${quoteIdentifier(table)}${ordering}${limitClause}`);
    return context.json({ rows, count: rows.length });
  });

  router.post("/clear-table", async (context) => {
    const result = tableSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid table payload" }, 400);
    }

    if (protectedTables.includes(result.data.table)) {
      return context.json({ error: "Cannot clear protected application tables" }, 403);
    }

    const cleared = await clearTable(sql, result.data.table);

    return context.json({ cleared });
  });

  router.post("/clear-all", async (context) => {
    const cleared = await clearAllTables(sql);

    return context.json({ cleared });
  });

  router.post("/drop-all", async (context) => {
    await dropAllTables(sql);

    return context.json({ dropped: true });
  });

  router.post("/migrate", async (context) => {
    await migrate(sql);

    return context.json({ migrated: true });
  });

  router.post("/seed", async (context) => {
    const seeded = await seed(sql);

    return context.json({ seeded });
  });

  router.post("/query", async (context) => {
    const result = querySchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid query payload" }, 400);
    }

    const rows = await sql.unsafe(result.data.sql);

    return context.json({
      rows: Array.isArray(rows) ? rows : [],
      count: Array.isArray(rows) ? rows.length : 0
    });
  });

  return router;
};
