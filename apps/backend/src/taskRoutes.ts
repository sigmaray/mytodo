import { buildTaskTree } from "@todoist-clone/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { TaskRepository } from "./repository";

/** Проверяет поля новой задачи и подставляет пустые значения контекста. */
const createTaskSchema = z.object({
  /** Название после удаления пробелов по краям. */
  title: z.string().trim().min(1),
  /** Родительская задача или корень дерева по умолчанию. */
  parentId: z.string().nullable().default(null),
  /** Проект назначения; `null` означает Входящие. */
  projectId: z.string().nullable().default(null),
  /** Секция назначения или значение по умолчанию без секции. */
  sectionId: z.string().nullable().default(null),
});

/** Проверяет допустимые поля задачи и целостность списка её комментариев. */
const patchTaskSchema = z.object({
  /** Новое название задачи. */
  title: z.string().trim().min(1).optional(),
  /** Подробное описание с ограничением размера API. */
  description: z.string().max(20000).optional(),
  /** Срок в календарном формате YYYY-MM-DD либо его сброс. */
  dueDate: z.string().date().nullable().optional(),
  /** Полный набор меток с ограничением количества и длины. */
  labels: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  /** Полный упорядоченный набор комментариев после редактирования. */
  comments: z
    .array(
      z.object({
        /** ID уже сохранённого комментария; отсутствие означает новый комментарий. */
        id: z.string().optional(),
        /** Текст комментария; он может быть пустым, если приложен файл. */
        body: z.string().max(5000),
        /** Ссылки на уже загруженные файлы, принадлежащие комментарию. */
        attachments: z
          .array(
            z.object({
              /** UUID файла во внутреннем хранилище. */
              id: z.string(),
              /** Имя файла для отображения и скачивания. */
              name: z.string(),
              /** MIME-тип файла. */
              mimeType: z.string(),
              /** Размер файла в байтах. */
              size: z.number(),
            }),
          )
          .optional(),
      }),
    )
    .refine(
      // Комментарий без текста разрешён только при наличии хотя бы одного вложения.
      (comments) =>
        comments.every((comment) => comment.body.trim().length > 0 || (comment.attachments?.length ?? 0) > 0),
      "Comment text or at least one attachment is required",
    )
    .refine(
      // Повторный ID мог бы неоднозначно обновить или удалить один комментарий.
      (comments) =>
        new Set(comments.flatMap((comment) => (comment.id === undefined ? [] : [comment.id]))).size ===
        comments.filter((comment) => comment.id !== undefined).length,
      "Comment IDs must be unique",
    )
    .optional(),
  completed: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
});

/** Проверяет новое место задачи и соседей для её позиционирования. */
const moveTaskSchema = z.object({
  /** Новый родитель задачи или корень дерева. */
  parentId: z.string().nullable().default(null),
  /** Новый проект назначения либо Входящие. */
  projectId: z.string().nullable().default(null),
  /** Новая секция назначения или корень списка. */
  sectionId: z.string().nullable().default(null),
  /** ID соседа, перед которым нужно разместить задачу. */
  beforeId: z.string().nullable().default(null),
  /** ID соседа, после которого нужно разместить задачу. */
  afterId: z.string().nullable().default(null),
});

/** Проверяет имя проекта и необязательную ссылку на родительский проект. */
const createProjectSchema = z.object({
  /** Название проекта после удаления пробелов по краям. */
  title: z.string().trim().min(1),
  /** Родительский проект для создания подпроекта. */
  parentId: z.string().nullable().default(null),
});
/** Проверяет идентификатор родителя при перемещении проекта. */
const moveProjectSchema = z.object({
  /** Новый родительский проект или `null`, чтобы переместить проект в корень. */
  parentId: z.string().nullable(),
});

/** Принимает только непустое обновление названия и/или описания проекта. */
const patchProjectSchema = z
  .object({
    /** Новое название проекта. */
    title: z.string().trim().min(1).optional(),
    /** Новое описание проекта. */
    description: z.string().max(20000).optional(),
  })
  .refine((patch) => patch.title !== undefined || patch.description !== undefined);

/** Определяет двух соседей, между которыми следует расположить проект или секцию. */
const reorderProjectSchema = z.object({
  /** Сосед, перед которым поставить сущность, либо `null`. */
  beforeId: z.string().nullable(),
  /** Сосед, после которого поставить сущность, либо `null`. */
  afterId: z.string().nullable(),
});
const reorderSectionSchema = reorderProjectSchema;

/** Проверяет данные новой секции и её проект. */
const createSectionSchema = z.object({
  /** Заголовок новой секции после удаления краевых пробелов. */
  title: z.string().trim().min(1),
  /** Проект-владелец или `null` для секции Входящих. */
  projectId: z.string().nullable().default(null),
});

/** Проверяет новое непустое название секции. */
const patchSectionSchema = z.object({
  /** Новое название секции. */
  title: z.string().trim().min(1),
});

/** Тип Hono-приложения с данными аутентифицированного пользователя. */
type ApplicationHono = Hono<{ Variables: { userId: string; authenticated: boolean } }>;
/** Фабрика репозитория, привязанного к идентификатору текущего пользователя. */
type RepositoryForUser = (userId: string) => TaskRepository;

/** Регистрирует HTTP-адаптеры задач, проектов и секций. */
export const registerTaskRoutes = (
  app: ApplicationHono,
  repositoryFor: RepositoryForUser,
  parseJson: (request: Request) => Promise<unknown>,
  projectArchivingEnabled: boolean,
  attachmentStorageAvailable: boolean,
  removeAttachments: (ids: Array<string>) => Promise<unknown>,
): void => {
  // Возвращаем плоские задачи вместе с построенным доменной функцией деревом.
  app.get("/tasks", async (context) => {
    const tasks = await repositoryFor(context.get("userId")).list();

    return context.json({ tasks, tree: buildTaskTree(tasks) });
  });

  // Проекты и секции отдаются отдельными коллекциями для загрузки workspace.
  app.get("/projects", async (context) => {
    const projects = await repositoryFor(context.get("userId")).listProjects();

    return context.json({ projects });
  });

  app.post("/projects", async (context) => {
    // Проверка схемы отделяет неверный HTTP-ввод от вызовов репозитория.
    const result = createProjectSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid project payload" }, 400);
    }

    if (
      result.data.parentId !== null &&
      !(await repositoryFor(context.get("userId")).listProjects()).some(
        (project) => project.id === result.data.parentId,
      )
    )
      return context.json({ error: "Parent project not found" }, 404);
    const project =
      result.data.parentId === null
        ? await repositoryFor(context.get("userId")).createProject(result.data.title)
        : await repositoryFor(context.get("userId")).createSubproject(
            result.data.title,
            result.data.parentId,
          );

    return context.json({ project }, 201);
  });

  app.patch("/projects/:id/parent", async (context) => {
    const result = moveProjectSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid project parent" }, 400);
    if (
      result.data.parentId !== null &&
      !(await repositoryFor(context.get("userId")).listProjects()).some(
        (project) => project.id === result.data.parentId,
      )
    )
      return context.json({ error: "Parent project not found" }, 404);
    const project = await repositoryFor(context.get("userId")).moveProject(
      context.req.param("id"),
      result.data.parentId,
    );
    return project === null
      ? context.json({ error: "Project not found or invalid parent" }, 404)
      : context.json({ project });
  });

  app.patch("/projects/:id", async (context) => {
    const result = patchProjectSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid project patch" }, 400);
    }

    const project = await repositoryFor(context.get("userId")).updateProject(
      context.req.param("id"),
      result.data,
    );

    return project === null ? context.json({ error: "Project not found" }, 404) : context.json({ project });
  });

  app.patch("/projects/:id/order", async (context) => {
    const result = reorderProjectSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid project order" }, 400);
    const project = await repositoryFor(context.get("userId")).reorderProject(
      context.req.param("id"),
      result.data.beforeId,
      result.data.afterId,
    );
    return project === null ? context.json({ error: "Project not found" }, 404) : context.json({ project });
  });

  app.post("/projects/:id/duplicate", async (context) => {
    const project = await repositoryFor(context.get("userId")).duplicateProject(context.req.param("id"));
    return project === null
      ? context.json({ error: "Project not found" }, 404)
      : context.json({ project }, 201);
  });

  app.patch("/projects/:id/archive", async (context) => {
    if (!projectArchivingEnabled) return context.json({ error: "Project archiving is disabled" }, 503);
    const result = z.object({ archived: z.boolean() }).safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid archive state" }, 400);
    const project = await repositoryFor(context.get("userId")).setProjectArchived(
      context.req.param("id"),
      result.data.archived,
    );
    return project === null ? context.json({ error: "Project not found" }, 404) : context.json({ project });
  });

  app.delete("/projects/:id", async (context) => {
    const deleted = await repositoryFor(context.get("userId")).deleteProject(context.req.param("id"));

    return deleted ? context.json({ deleted: true }) : context.json({ error: "Project not found" }, 404);
  });

  app.get("/sections", async (context) => {
    const sections = await repositoryFor(context.get("userId")).listSections();

    return context.json({ sections });
  });

  app.post("/sections", async (context) => {
    // До создания секции проверяем, что указанный проект принадлежит пользователю.
    const result = createSectionSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid section payload" }, 400);
    }

    if (
      result.data.projectId !== null &&
      !(await repositoryFor(context.get("userId")).listProjects()).some(
        (project) => project.id === result.data.projectId,
      )
    )
      return context.json({ error: "Project not found" }, 404);

    const section = await repositoryFor(context.get("userId")).createSection(
      result.data.title,
      result.data.projectId,
    );

    return context.json({ section }, 201);
  });

  app.patch("/sections/:id/order", async (context) => {
    const result = reorderSectionSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid section order" }, 400);
    const section = await repositoryFor(context.get("userId")).reorderSection(
      context.req.param("id"),
      result.data.beforeId,
      result.data.afterId,
    );
    return section === null ? context.json({ error: "Section not found" }, 404) : context.json({ section });
  });

  app.patch("/sections/:id", async (context) => {
    const result = patchSectionSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid section patch" }, 400);
    }

    const section = await repositoryFor(context.get("userId")).updateSection(
      context.req.param("id"),
      result.data.title,
    );

    return section === null ? context.json({ error: "Section not found" }, 404) : context.json({ section });
  });

  app.delete("/sections/:id", async (context) => {
    const deleted = await repositoryFor(context.get("userId")).deleteSection(context.req.param("id"));

    return deleted ? context.json({ deleted: true }) : context.json({ error: "Section not found" }, 404);
  });

  app.post("/tasks", async (context) => {
    // Проверяем ссылки на родителя, проект и секцию в данных текущего пользователя.
    const result = createTaskSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid task payload" }, 400);
    }

    const taskRepository = repositoryFor(context.get("userId"));
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
    if (
      result.data.sectionId !== null &&
      (await taskRepository.listSections()).find((section) => section.id === result.data.sectionId)
        ?.projectId !== result.data.projectId
    )
      return context.json({ error: "Section does not belong to project" }, 400);

    const task = await taskRepository.create(
      result.data.title,
      result.data.parentId,
      result.data.projectId,
      result.data.sectionId,
    );

    return context.json({ task }, 201);
  });

  app.patch("/tasks/:id", async (context) => {
    // Сохраняем прежнюю задачу для проверки связей и очистки удалённых вложений.
    const result = patchTaskSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid task patch" }, 400);
    }

    const taskRepository = repositoryFor(context.get("userId"));
    const previous = (await taskRepository.list()).find((item) => item.id === context.req.param("id"));
    const nextProjectId = result.data.projectId === undefined ? previous?.projectId : result.data.projectId;
    const nextSectionId = result.data.sectionId === undefined ? previous?.sectionId : result.data.sectionId;
    if (
      nextSectionId !== null &&
      nextSectionId !== undefined &&
      (await taskRepository.listSections()).find((section) => section.id === nextSectionId)?.projectId !==
        nextProjectId
    )
      return context.json({ error: "Section does not belong to project" }, 400);
    // Клиент может переиспользовать только метаданные вложений из прежних комментариев.
    if (previous !== undefined && result.data.comments !== undefined) {
      const allowed = new Map(previous.comments.map((comment) => [comment.id, comment.attachments ?? []]));
      const hasForgedAttachment = result.data.comments.some((comment) =>
        (comment.attachments ?? []).some(
          (attachment) =>
            !(comment.id === undefined ? [] : (allowed.get(comment.id) ?? [])).some(
              (existing) =>
                existing.id === attachment.id &&
                existing.name === attachment.name &&
                existing.mimeType === attachment.mimeType &&
                existing.size === attachment.size,
            ),
        ),
      );
      if (hasForgedAttachment)
        return context.json({ error: "Attachment metadata cannot be changed through task updates" }, 400);
    }
    const task = await taskRepository.patch(context.req.param("id"), result.data);

    // После успешного обновления удаляем файлы вложений, больше не связанные с комментариями.
    if (
      task !== null &&
      previous !== undefined &&
      attachmentStorageAvailable &&
      result.data.comments !== undefined
    ) {
      const retained = new Set(
        task.comments.flatMap((comment) => comment.attachments?.map((attachment) => attachment.id) ?? []),
      );
      const removed = previous.comments
        .flatMap((comment) => comment.attachments?.map((attachment) => attachment.id) ?? [])
        .filter((id) => !retained.has(id));
      await removeAttachments(removed);
    }

    return task === null ? context.json({ error: "Task not found" }, 404) : context.json({ task });
  });

  app.put("/tasks/:id/move", async (context) => {
    // Секция должна принадлежать тому же проекту, в который перемещается задача.
    const result = moveTaskSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid task move" }, 400);
    }

    const taskRepository = repositoryFor(context.get("userId"));
    if (
      result.data.sectionId !== null &&
      (await taskRepository.listSections()).find((section) => section.id === result.data.sectionId)
        ?.projectId !== result.data.projectId
    )
      return context.json({ error: "Section does not belong to project" }, 400);
    const task = await taskRepository.move(context.req.param("id"), result.data);

    return task === null ? context.json({ error: "Task not found" }, 404) : context.json({ task });
  });
};
