import { bodyLimit } from "hono/body-limit";
import type { AppHono, RepositoryForUser } from "./appTypes";
import type { AttachmentMetadata, AttachmentStorage } from "./attachmentStorage";
import { detectSafeImageMimeType, validateAttachmentFiles } from "./attachmentStorage";

/**
 * Регистрирует API загрузки комментариев с файлами и чтения вложений.
 *
 * @param {AppHono} app
 * @param {{ repositoryFor: RepositoryForUser; attachmentStorage: AttachmentStorage; attachmentStorageAvailable: boolean; }} dependencies
 */
export const registerAttachmentRoutes = (
  app: AppHono,
  dependencies: {
    repositoryFor: RepositoryForUser;
    attachmentStorage: AttachmentStorage;
    attachmentStorageAvailable: boolean;
  },
) => {
  /** Для каждого запроса выбирается репозиторий пользователя из установленной сессии. */
  const { repositoryFor, attachmentStorage, attachmentStorageAvailable } = dependencies;
  app.post("/tasks/:id/comments", bodyLimit({ maxSize: 26 * 1024 * 1024 }), async (context) => {
    /** Проверяем доступность и существование задачи до сохранения переданных файлов. */
    if (!attachmentStorageAvailable) return context.json({ error: "Attachments are disabled" }, 503);
    const taskRepository = repositoryFor(context.get("userId"));
    const taskId = context.req.param("id");
    const task = (await taskRepository.list()).find((item) => item.id === taskId);
    if (task === undefined) return context.json({ error: "Task not found" }, 404);
    let form: FormData;
    /** Разбор multipart может завершиться ошибкой при некорректном теле запроса. */
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "Invalid multipart form" }, 400);
    }
    const body = String(form.get("body") ?? "").trim();
    const files = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (body.length > 5000 || (!body && files.length === 0))
      return context.json({ error: "Comment text or at least one attachment is required" }, 400);
    const fileValidation = validateAttachmentFiles(files);
    if (fileValidation === "invalid-file")
      return context.json({ error: "Unsupported filename or MIME type" }, 400);
    if (fileValidation === "limits-exceeded")
      return context.json({ error: "Attachment limits exceeded (10 files, 10 MB each, 25 MB total)" }, 413);
    /** Если запись комментария не удастся, созданные файлы будут удалены в обработчике ошибки. */
    let attachments: Array<AttachmentMetadata> | undefined;
    try {
      attachments = await attachmentStorage.saveMany(files);
      const comment = {
        id: crypto.randomUUID(),
        body,
        createdAt: new Date().toISOString(),
        ...(attachments.length ? { attachments: attachments } : {}),
      };
      if (!(await taskRepository.addComment(taskId, comment))) throw new Error("Task not found");
      return context.json({ comment }, 201);
    } catch {
      await attachmentStorage.removeMany(attachments?.map((attachment) => attachment.id) ?? []);
      return context.json({ error: "Could not save comment and attachments" }, 500);
    }
  });

  app.get("/attachments/:id", async (context) => {
    /** Перед чтением файла убеждаемся, что он указан в комментарии текущего пользователя. */
    if (!attachmentStorageAvailable) return context.json({ error: "Attachments are disabled" }, 503);
    const id = context.req.param("id");
    const uuid = /^[0-9a-f-]{36}$/i.test(id);
    if (!uuid) return context.json({ error: "Attachment not found" }, 404);
    const tasks = await repositoryFor(context.get("userId")).list();
    const attachment = tasks
      .flatMap((task) =>
        task.comments.flatMap((comment) =>
          (comment.attachments ?? [])
            .filter((item) => item.id === id)
            .map((item) => ({ item, taskId: task.id })),
        ),
      )
      .at(0);
    if (attachment === undefined) return context.json({ error: "Attachment not found" }, 404);
    const contents = await attachmentStorage.read(id);
    if (contents === null) return context.json({ error: "Attachment not found" }, 404);
    const safeName = attachment.item.name.replace(/[\r\n\"\\]/g, "_");
    const safeImageType = detectSafeImageMimeType(contents);
    context.header("Content-Type", safeImageType ?? "application/octet-stream");
    context.header(
      "Content-Disposition",
      `${safeImageType === null ? "attachment" : "inline"}; filename="${safeName}"`,
    );
    context.header("X-Content-Type-Options", "nosniff");
    context.header("Content-Security-Policy", "default-src 'none'; sandbox");
    context.header("Cache-Control", "private, no-store");
    return context.body(new Uint8Array(contents));
  });
};
