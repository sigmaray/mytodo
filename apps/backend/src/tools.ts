import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import postgres from "postgres";
import { z } from "zod";
import { defaultAdminUserId } from "./users";

/** Validates a table name selected by the administrator in database tools. */
const tableSchema = z.object({
  table: z.string().trim().min(1),
});

/** Validates an SQL query submitted through the administration tools panel. */
const querySchema = z.object({
  sql: z.string().trim().min(1),
});

/** Allowed SQL identifier syntax before escaping. */
const tableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Escapes a table identifier so it can be safely included in an SQL statement.
 *
 * @param {string} name
 * @returns The escaped identifier.
 */
const quoteIdentifier = (name: string) => {
  if (!tableNamePattern.test(name)) {
    throw new Error("Invalid table name");
  }

  return `"${name}"`;
};

/** Complete list of migrations used by the manual schema setup tool. */
const migrationFiles = [
  /** Order matters: migrations run sequentially from the initial schema to the current one. */
  new URL("../drizzle/0000_create_tasks.sql", import.meta.url),
  new URL("../drizzle/0001_settings_auth.sql", import.meta.url),
  new URL("../drizzle/0002_task_details_archives.sql", import.meta.url),
  new URL("../drizzle/0003_remove_task_priorities.sql", import.meta.url),
  new URL("../drizzle/0004_scope_descriptions.sql", import.meta.url),
  new URL("../drizzle/0005_project_hierarchy.sql", import.meta.url),
  new URL("../drizzle/0006_users.sql", import.meta.url),
  new URL("../drizzle/0007_task_comments.sql", import.meta.url),
  new URL("../drizzle/0008_data_integrity.sql", import.meta.url),
  new URL("../drizzle/0009_database_constraints_and_indexes.sql", import.meta.url),
  new URL("../drizzle/0010_uuid_user_ids.sql", import.meta.url),
];
/** Account and session tables that data tools must not clear. */
const protectedTables = ["sessions", "users"];

/** Predictable sample tasks used to verify nesting after seeding the database. */
const seedTasks = [
  {
    id: "seed-inbox",
    title: "Review seeded task",
    parentId: null,
    lexicalOrder: "U",
  },
  {
    id: "seed-child",
    title: "Nested seeded task",
    parentId: "seed-inbox",
    lexicalOrder: "U",
  },
];

/**
 * Parses a tools request JSON body or returns an empty object.
 *
 * @param {Request} request
 * @returns The parsed request body.
 */
const parseJson = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};

/**
 * Returns the application table names in the current PostgreSQL schema.
 *
 * @param {postgres.Sql} sql
 */
const listTables = async (sql: postgres.Sql) =>
  sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

/**
 * Clears a table whose name is in the allowed set.
 *
 * @param {postgres.Sql} sql
 * @param {string} table
 * @returns Whether the table was cleared.
 */
const clearTable = async (sql: postgres.Sql, table: string) => {
  if (protectedTables.includes(table)) {
    throw new Error("Application settings and session tables cannot be cleared from Tools");
  }

  await sql.unsafe(`TRUNCATE TABLE ${quoteIdentifier(table)} RESTART IDENTITY CASCADE`);

  return { table };
};

/**
 * Clears application table data while preserving protected accounts.
 *
 * @param {postgres.Sql} sql
 * @returns The result of clearing the tables.
 */
const clearAllTables = async (sql: postgres.Sql) => {
  /** Preserve service accounts and sessions so the administrator retains access. */
  const tables = (await listTables(sql)).filter((table) => !protectedTables.includes(table.table_name));

  /** Clear independent tables in parallel after collecting the complete table list. */
  await Promise.all(tables.map((table) => clearTable(sql, table.table_name)));

  return { tables: tables.map((table) => table.table_name) };
};

/**
 * Drops application tables and related schema objects for an explicit database reset.
 *
 * @param {postgres.Sql} sql
 */
const dropAllTables = async (sql: postgres.Sql) => {
  /** Read names from the system catalog and let PostgreSQL format them as identifiers. */
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

/**
 * Applies the built-in SQL migrations in order and records their completion.
 *
 * @param {postgres.Sql} sql
 */
const migrate = async (sql: postgres.Sql) => {
  for (const migrationFile of migrationFiles) {
    /** These migrations run through the admin endpoint and are idempotent. */
    await sql.unsafe(await readFile(migrationFile, "utf8"));
  }
};

/**
 * Seeds the database with sample tasks for initial setup and verification.
 *
 * @param {postgres.Sql} sql
 * @returns The result of seeding the database.
 */
const seed = async (sql: postgres.Sql) => {
  /** Prepare the schema first so seeding also works on an empty database. */
  await migrate(sql);
  await Promise.all(
    seedTasks.map(
      (task) =>
        sql`
        INSERT INTO tasks (id, user_id, title, completed, parent_id, lexical_order)
        VALUES (${task.id}, ${defaultAdminUserId}, ${task.title}, false, ${task.parentId}, ${task.lexicalOrder})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          user_id = EXCLUDED.user_id,
          completed = EXCLUDED.completed,
          parent_id = EXCLUDED.parent_id,
          lexical_order = EXCLUDED.lexical_order,
          updated_at = now()
      `,
    ),
  );

  return { inserted: seedTasks.length };
};

/**
 * Creates an administrative Hono router for database maintenance.
 *
 * @param {string} databaseUrl
 * @param {string} mode
 * @returns The database tools router.
 */
export const createToolsRouter = (databaseUrl: string, mode: string) => {
  const router = new Hono();
  const enabled = mode !== "production";
  const sql = postgres(databaseUrl, { max: 1 });

  router.use("*", async (context, next) => {
    /** Hide these tools in production, including for direct API requests. */
    if (!enabled) {
      return context.json({ error: "Tools are disabled" }, 404);
    }

    return next();
  });

  router.get("/tables", async (context) => {
    /** Return only table names available in the current schema. */
    const tables = await listTables(sql);

    return context.json({ tables: tables.map((table) => table.table_name) });
  });

  router.get("/records/:table", async (context) => {
    /** Validate the table name and limit the allowed result size before querying SQL. */
    const table = context.req.param("table");
    const limitParam = context.req.query("limit") ?? "10";
    const limit = limitParam === "all" ? null : Number(limitParam);
    const tables = await listTables(sql);
    if (!tableNamePattern.test(table) || !tables.some((item) => item.table_name === table))
      return context.json({ error: "Unknown table" }, 404);
    if (limit !== null && limit !== 10 && limit !== 100)
      return context.json({ error: "Limit must be 10, 100, or all" }, 400);
    /** For predictable results, sort by created_at or id when that column exists. */
    const columns = await sql<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ${table}`;
    const orderColumn = columns.some((column) => column.column_name === "created_at")
      ? "created_at"
      : columns.some((column) => column.column_name === "id")
        ? "id"
        : null;
    const ordering = orderColumn === null ? "" : ` ORDER BY ${quoteIdentifier(orderColumn)} DESC`;
    const limitClause = limit === null ? "" : ` LIMIT ${limit}`;
    const rows = await sql.unsafe(`SELECT * FROM ${quoteIdentifier(table)}${ordering}${limitClause}`);
    return context.json({ rows, count: rows.length });
  });

  router.post("/clear-table", async (context) => {
    /** This endpoint clears only one non-protected table. */
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
    /** Clear user data while preserving the user and session tables. */
    const cleared = await clearAllTables(sql);

    return context.json({ cleared });
  });

  router.post("/drop-all", async (context) => {
    /** Dropping tables is a separate administrative operation. */
    await dropAllTables(sql);

    return context.json({ dropped: true });
  });

  router.post("/migrate", async (context) => {
    /** Apply migrations before returning the result to the client. */
    await migrate(sql);

    return context.json({ migrated: true });
  });

  router.post("/seed", async (context) => {
    /** Seed the database with sample tasks to verify a local installation. */
    const seeded = await seed(sql);

    return context.json({ seeded });
  });

  router.post("/query", async (context) => {
    /** The SQL endpoint is for diagnostics and runs only in development or test. */
    const result = querySchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid query payload" }, 400);
    }

    const rows = await sql.unsafe(result.data.sql);

    return context.json({
      rows: Array.isArray(rows) ? rows : [],
      count: Array.isArray(rows) ? rows.length : 0,
    });
  });

  return router;
};
