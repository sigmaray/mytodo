import postgres from "postgres";
import { z } from "zod";
import { createProjectSchema, createSectionSchema, createTaskSchema, parseJson } from "./appSchemas";
import type { AppHono, RepositoryForUser } from "./appTypes";
import type { AttachmentStorage } from "./attachmentStorage";

/**
 * Регистрирует закрытые вспомогательные маршруты подготовки Playwright-сценариев.
 *
 * @param {AppHono} app
 * @param {{ database: ReturnType<typeof postgres>; attachmentStorage: AttachmentStorage; attachmentStorageAvailable: boolean; repositoryFor: RepositoryForUser; }} dependencies
 * @param {ReturnType<typeof postgres>} dependencies.database - Соединение с отдельной базой, используемой только тестами Playwright.
 * @param {AttachmentStorage} dependencies.attachmentStorage - Файловое хранилище, куда тесты сохраняют временные вложения.
 * @param {boolean} dependencies.attachmentStorageAvailable - Признак, что создание и чтение тестовых вложений доступно.
 * @param {RepositoryForUser} dependencies.repositoryFor - Возвращает доменный репозиторий для пользователя тестового запроса.
 */
export const registerPlaywrightRoutes = (
  app: AppHono,
  dependencies: /**
   * Поля этой структуры:
   * - `database`: Соединение с отдельной базой, используемой только тестами Playwright.
   * - `attachmentStorage`: Файловое хранилище, куда тесты сохраняют временные вложения.
   * - `attachmentStorageAvailable`: Признак, что создание и чтение тестовых вложений доступно.
   * - `repositoryFor`: Возвращает доменный репозиторий для пользователя тестового запроса.
   */
  {
    database: ReturnType<typeof postgres>;

    attachmentStorage: AttachmentStorage;

    attachmentStorageAvailable: boolean;

    repositoryFor: RepositoryForUser;
  },
) => {
  /** Список таблиц и сущностей намеренно ограничен, чтобы тестовый API не стал произвольным SQL-интерфейсом. */
  const {
    database: playwrightDatabase,
    attachmentStorage,
    attachmentStorageAvailable,
    repositoryFor,
  } = dependencies;
  /** Набор допустимых таблиц исключает очистку учётных записей и произвольного SQL. */
  const testTables = {
    /** Таблица задач. */
    tasks: "tasks",
    /** Таблица комментариев. */
    task_comments: "task_comments",
    /** Таблица секций. */
    sections: "sections",
    /** Таблица проектов. */
    projects: "projects",
  } as const;
  /**
   * Удаляет данные пользователя из разрешённой таблицы и очищает её файлы вложений.
   *
   * @param {keyof typeof testTables} table
   * @param {string} userId
   * @returns Результат выполнения функции.
   */
  const clearTestTable = async (table: keyof typeof testTables, userId: string) => {
    /** Перед удалением задач/комментариев сохраняем ID вложений для очистки файловой системы. */
    const attachmentRows =
      table === "tasks" || table === "task_comments"
        ? await playwrightDatabase<
            { attachments: unknown }[]
          >`SELECT attachments FROM task_comments WHERE user_id = ${userId}`
        : [];
    /** Имя таблицы берётся только из allowlist, а значение userId передаётся параметром SQL. */
    const result = await playwrightDatabase.unsafe(`DELETE FROM ${testTables[table]} WHERE user_id = $1`, [
      userId,
    ]);
    if (attachmentStorage.enabled) {
      const attachmentIds = attachmentRows.flatMap((row) =>
        Array.isArray(row.attachments)
          ? row.attachments.flatMap((attachment) =>
              typeof attachment === "object" &&
              attachment !== null &&
              "id" in attachment &&
              typeof attachment.id === "string" &&
              /^[0-9a-f-]{36}$/i.test(attachment.id)
                ? [attachment.id]
                : [],
            )
          : [],
      );
      await attachmentStorage.removeMany(attachmentIds);
    }
    return result.count;
  };

  app.post("/api/playwright/reset", async (context) => {
    /** Сбрасываем только данные тестовых сущностей, сохраняя пользователей и сессии. */
    const userId = context.get("userId");
    if (attachmentStorage.enabled) await clearTestTable("task_comments", userId);
    await playwrightDatabase.begin(async (transaction) => {
      await transaction`DELETE FROM tasks`;
      await transaction`DELETE FROM sections`;
      await transaction`DELETE FROM projects`;
      await transaction`DELETE FROM sessions WHERE user_id <> ${userId}`;
      await transaction`DELETE FROM users WHERE id <> ${userId}`;
      await transaction`UPDATE users SET confirm_delete = true, inbox_description = '' WHERE id = ${userId}`;
    });
    return context.json({ reset: true });
  });

  app.delete("/api/playwright/tables/:table", async (context) => {
    /** Удаляем записи только из таблицы, прошедшей проверку разрешённого списка. */
    const table = context.req.param("table");
    if (!Object.hasOwn(testTables, table)) return context.json({ error: "Unsupported test table" }, 400);
    const deleted = await clearTestTable(table as keyof typeof testTables, context.get("userId"));
    return context.json({ table, deleted });
  });

  app.post("/api/playwright/entities/:entity", async (context) => {
    /** Создаём одну из поддерживаемых тестовых сущностей из валидированного тела запроса. */
    const entity = context.req.param("entity");
    const taskRepository = repositoryFor(context.get("userId"));
    if (entity === "task") {
      const result = createTaskSchema.safeParse(await parseJson(context.req.raw));
      if (!result.success) return context.json({ error: "Invalid task payload" }, 400);
      if (
        result.data.parentId !== null &&
        !(await taskRepository.list()).some((task) => task.id === result.data.parentId)
      )
        return context.json({ error: "Parent task not found" }, 404);
      if (
        result.data.projectId !== null &&
        !(await taskRepository.listProjects()).some((project) => project.id === result.data.projectId)
      )
        return context.json({ error: "Project not found" }, 404);
      if (
        result.data.sectionId !== null &&
        !(await taskRepository.listSections()).some((section) => section.id === result.data.sectionId)
      )
        return context.json({ error: "Section not found" }, 404);
      const task = await taskRepository.create(
        result.data.title,
        result.data.parentId,
        result.data.projectId,
        result.data.sectionId,
      );
      return context.json({ task }, 201);
    }
    if (entity === "project") {
      const result = createProjectSchema.safeParse(await parseJson(context.req.raw));
      if (!result.success) return context.json({ error: "Invalid project payload" }, 400);
      if (
        result.data.parentId !== null &&
        !(await taskRepository.listProjects()).some((project) => project.id === result.data.parentId)
      )
        return context.json({ error: "Parent project not found" }, 404);
      const project =
        result.data.parentId === null
          ? await taskRepository.createProject(result.data.title)
          : await taskRepository.createSubproject(result.data.title, result.data.parentId);
      return context.json({ project }, 201);
    }
    if (entity === "section") {
      const result = createSectionSchema.safeParse(await parseJson(context.req.raw));
      if (!result.success) return context.json({ error: "Invalid section payload" }, 400);
      if (
        result.data.projectId !== null &&
        !(await taskRepository.listProjects()).some((project) => project.id === result.data.projectId)
      )
        return context.json({ error: "Project not found" }, 404);
      const section = await taskRepository.createSection(result.data.title, result.data.projectId);
      return context.json({ section }, 201);
    }
    if (entity === "comment") {
      const result = z
        .object({ taskId: z.string().min(1), body: z.string().max(5000).default("") })
        .refine((value) => value.body.trim().length > 0)
        .safeParse(await parseJson(context.req.raw));
      if (!result.success) return context.json({ error: "Invalid comment payload" }, 400);
      const task = (await taskRepository.list()).find((item) => item.id === result.data.taskId);
      if (task === undefined) return context.json({ error: "Task not found" }, 404);
      const comment = {
        id: crypto.randomUUID(),
        body: result.data.body,
        createdAt: new Date().toISOString(),
      };
      if (!(await taskRepository.addComment(task.id, comment)))
        return context.json({ error: "Task not found" }, 404);
      return context.json({ comment }, 201);
    }
    if (entity === "attachment") {
      if (!attachmentStorageAvailable) return context.json({ error: "Attachments are disabled" }, 503);
      let form: FormData;
      try {
        form = await context.req.formData();
      } catch {
        return context.json({ error: "Invalid multipart form" }, 400);
      }
      const taskId = String(form.get("taskId") ?? "");
      const body = String(form.get("body") ?? "").trim();
      const task = (await taskRepository.list()).find((item) => item.id === taskId);
      if (task === undefined) return context.json({ error: "Task not found" }, 404);
      const files = form
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
      if (files.length !== 1 || body.length > 5000 || files[0]!.size > 10 * 1024 * 1024)
        return context.json({ error: "One attachment up to 10 MB is required" }, 400);
      const file = files[0]!;
      const [attachment] = await attachmentStorage.saveMany([file]);
      const comment = {
        id: crypto.randomUUID(),
        body,
        createdAt: new Date().toISOString(),
        attachments: [attachment],
      };
      try {
        if (!(await taskRepository.addComment(task.id, comment))) throw new Error("Task not found");
        return context.json({ comment, attachment }, 201);
      } catch {
        await attachmentStorage.remove(attachment.id);
        return context.json({ error: "Could not create test attachment" }, 500);
      }
    }
    return context.json({ error: "Unsupported test entity" }, 400);
  });
};
