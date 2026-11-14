import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import postgres from "postgres";
import { z } from "zod";
import { defaultAdminUserId } from "./users";

/** Проверяет имя таблицы, которую администратор выбрал в инструментах базы данных. */
const tableSchema = z.object({
  table: z.string().trim().min(1),
});

/** Проверяет SQL-запрос, переданный через административную панель инструментов. */
const querySchema = z.object({
  sql: z.string().trim().min(1),
});

/** Разрешённый синтаксис SQL-идентификатора до его экранирования. */
const tableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Экранирует идентификатор таблицы для безопасной вставки в SQL-команду.
 *
 * @param {string} name
 * @returns Результат выполнения функции.
 */
const quoteIdentifier = (name: string) => {
  if (!tableNamePattern.test(name)) {
    throw new Error("Invalid table name");
  }

  return `"${name}"`;
};

/** Полный список миграций, применяемых инструментом ручной настройки схемы. */
const migrationFiles = [
  /** Порядок важен: миграции применяются последовательно от исходной схемы к текущей. */
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
/** Таблицы аккаунтов и сессий, которые нельзя очищать инструментами данных. */
const protectedTables = ["sessions", "users"];

/** Набор предсказуемых задач для проверки вложенности после заполнения базы. */
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
 * Разбирает тело JSON-запроса инструментов или возвращает пустой объект.
 *
 * @param {Request} request
 * @returns Результат выполнения функции.
 */
const parseJson = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};

/**
 * Получает имена прикладных таблиц текущей схемы PostgreSQL.
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
 * Очищает таблицу по имени из допустимого набора.
 *
 * @param {postgres.Sql} sql
 * @param {string} table
 * @returns Результат выполнения функции.
 */
const clearTable = async (sql: postgres.Sql, table: string) => {
  if (protectedTables.includes(table)) {
    throw new Error("Application settings and session tables cannot be cleared from Tools");
  }

  await sql.unsafe(`TRUNCATE TABLE ${quoteIdentifier(table)} RESTART IDENTITY CASCADE`);

  return { table };
};

/**
 * Очищает данные прикладных таблиц, не затрагивая защищённые учётные записи.
 *
 * @param {postgres.Sql} sql
 * @returns Результат выполнения функции.
 */
const clearAllTables = async (sql: postgres.Sql) => {
  /** Служебные аккаунты и сессии сохраняются, чтобы администратор не потерял доступ. */
  const tables = (await listTables(sql)).filter((table) => !protectedTables.includes(table.table_name));

  /** Независимые таблицы очищаются параллельно после получения единого списка. */
  await Promise.all(tables.map((table) => clearTable(sql, table.table_name)));

  return { tables: tables.map((table) => table.table_name) };
};

/**
 * Удаляет прикладные таблицы и связанные объекты схемы для явного сброса БД.
 *
 * @param {postgres.Sql} sql
 */
const dropAllTables = async (sql: postgres.Sql) => {
  /** Имена берутся из системного каталога, а PostgreSQL форматирует их как идентификаторы. */
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
 * Последовательно применяет встроенные SQL-миграции и отмечает их выполнение.
 *
 * @param {postgres.Sql} sql
 */
const migrate = async (sql: postgres.Sql) => {
  for (const migrationFile of migrationFiles) {
    /** Эти миграции запускаются административным endpoint и содержат собственную идемпотентность. */
    await sql.unsafe(await readFile(migrationFile, "utf8"));
  }
};

/**
 * Наполняет базу демонстрационными задачами для начальной настройки и проверки.
 *
 * @param {postgres.Sql} sql
 * @returns Результат выполнения функции.
 */
const seed = async (sql: postgres.Sql) => {
  /** Сначала подготавливаем схему, чтобы заполнение работало и на пустой базе. */
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
 * Создаёт административный Hono-маршрутизатор для обслуживания базы данных.
 *
 * @param {string} databaseUrl
 * @param {string} mode
 * @returns Результат выполнения функции.
 */
export const createToolsRouter = (databaseUrl: string, mode: string) => {
  const router = new Hono();
  const enabled = mode !== "production";
  const sql = postgres(databaseUrl, { max: 1 });

  router.use("*", async (context, next) => {
    /** Роутер скрывает инструменты в production даже при прямом обращении к API. */
    if (!enabled) {
      return context.json({ error: "Tools are disabled" }, 404);
    }

    return next();
  });

  router.get("/tables", async (context) => {
    /** Возвращаем только имена таблиц, доступных в текущей схеме. */
    const tables = await listTables(sql);

    return context.json({ tables: tables.map((table) => table.table_name) });
  });

  router.get("/records/:table", async (context) => {
    /** Проверяем имя таблицы и ограничиваем допустимый размер выборки перед SQL-запросом. */
    const table = context.req.param("table");
    const limitParam = context.req.query("limit") ?? "10";
    const limit = limitParam === "all" ? null : Number(limitParam);
    const tables = await listTables(sql);
    if (!tableNamePattern.test(table) || !tables.some((item) => item.table_name === table))
      return context.json({ error: "Unknown table" }, 404);
    if (limit !== null && limit !== 10 && limit !== 100)
      return context.json({ error: "Limit must be 10, 100, or all" }, 400);
    /** Для предсказуемого просмотра выбираем сортировку по created_at или id, если колонка есть. */
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
    /** Отдельный endpoint очищает только одну непубличную таблицу. */
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
    /** Сбрасывает пользовательские данные, оставляя таблицы пользователей и сессий. */
    const cleared = await clearAllTables(sql);

    return context.json({ cleared });
  });

  router.post("/drop-all", async (context) => {
    /** Удаление таблиц является отдельной административной операцией. */
    await dropAllTables(sql);

    return context.json({ dropped: true });
  });

  router.post("/migrate", async (context) => {
    /** Применяет миграции до возврата результата клиенту. */
    await migrate(sql);

    return context.json({ migrated: true });
  });

  router.post("/seed", async (context) => {
    /** Заполняет БД демонстрационными задачами для проверки локальной установки. */
    const seeded = await seed(sql);

    return context.json({ seeded });
  });

  router.post("/query", async (context) => {
    /** SQL endpoint предназначен для диагностики и выполняется только в development/test. */
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
