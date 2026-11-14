import { type APIRequestContext, expect } from "@playwright/test";

/** Отправляет POST JSON и добавляет тело ответа к сообщению ошибки проверки. */
const postJson = async <T>(request: APIRequestContext, path: string, data?: unknown): Promise<T> => {
  // Если тело не задано, отправляем пустой запрос, а не JSON null.
  const response = await request.post(path, data === undefined ? {} : { data });
  // Читаем тело один раз и включаем его в сообщение для диагностики неуспешного запроса.
  const text = await response.text();
  expect(response.ok(), `POST ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

/** Отправляет PATCH JSON и разбирает ответ после проверки HTTP-статуса. */
const patchJson = async <T>(request: APIRequestContext, path: string, data: unknown): Promise<T> => {
  const response = await request.patch(path, { data });
  // Текст ответа сохраняется для ошибки expect, затем разбирается как JSON.
  const text = await response.text();
  expect(response.ok(), `PATCH ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

/** Допустимые значения полей при формировании multipart-запроса Playwright. */
type MultipartValue =
  | string
  | number
  | boolean
  | {
      /** Имя файла, передаваемое multipart-формой. */
      name: string;
      /** MIME-тип содержимого файла. */
      mimeType: string;
      /** Байты файла, которые Playwright включает в запрос. */
      buffer: Buffer;
    };

/** Отправляет multipart-форму, проверяет ответ и возвращает JSON-результат. */
const postMultipart = async <T>(
  request: APIRequestContext,
  path: string,
  form: Record<string, MultipartValue>,
): Promise<T> => {
  const response = await request.post(path, { multipart: form });
  // Ответ multipart-запроса проверяется так же, как JSON, а его текст включается в сообщение ошибки.
  const text = await response.text();
  expect(response.ok(), `POST ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

/** Создаёт API-набор вспомогательных операций для подготовки E2E-данных. */
export const createE2eApi = (request: APIRequestContext) => ({
  reset: async () => postJson<{ reset: true }>(request, "/api/playwright/reset"),
  clearTable: async (table: "tasks" | "task_comments" | "sections" | "projects") => {
    const response = await request.delete(`/api/playwright/tables/${table}`);
    const text = await response.text();
    expect(response.ok(), `DELETE test table ${table} failed (${response.status()}): ${text}`).toBe(true);
    return JSON.parse(text) as { table: string; deleted: number };
  },
  createProject: async (title: string, parentId: string | null = null) => {
    const result = await postJson<{ project: { id: string; title: string } }>(
      request,
      "/api/playwright/entities/project",
      { title, parentId },
    );
    return result.project;
  },
  createSection: async (title: string, projectId: string | null = null) => {
    const result = await postJson<{ section: { id: string; title: string } }>(
      request,
      "/api/playwright/entities/section",
      { title, projectId },
    );
    return result.section;
  },
  createTask: async (
    title: string,
    placement: {
      /** ID проекта назначения или `null` для Входящих. */
      projectId?: string | null;
      /** ID секции назначения или `null` для корня списка. */
      sectionId?: string | null;
      /** ID родительской задачи или `null` для корневой задачи. */
      parentId?: string | null;
    } = {},
  ) => {
    const result = await postJson<{ task: { id: string; title: string } }>(
      request,
      "/api/playwright/entities/task",
      {
        title,
        // Заполняем отсутствующие части размещения одинаковыми nullable значениями API.
        projectId: placement.projectId ?? null,
        sectionId: placement.sectionId ?? null,
        parentId: placement.parentId ?? null,
      },
    );
    return result.task;
  },
  createComment: async (taskId: string, body: string) => {
    const result = await postJson<{ comment: { id: string; body: string } }>(
      request,
      "/api/playwright/entities/comment",
      { taskId, body },
    );
    return result.comment;
  },
  createAttachment: async (
    taskId: string,
    file: {
      /** Исходное имя загружаемого файла. */
      name: string;
      /** MIME-тип, объявленный в multipart-запросе. */
      mimeType: string;
      /** Содержимое файла в байтовом буфере. */
      buffer: Buffer;
    },
    body = "",
  ) => {
    const result = await postMultipart<{
      comment: { id: string };
      attachment: { id: string; name: string; size: number };
    }>(request, "/api/playwright/entities/attachment", {
      taskId,
      body,
      files: { name: file.name, mimeType: file.mimeType, buffer: file.buffer },
    });
    return result;
  },
  updateTask: async (taskId: string, data: Record<string, unknown>) =>
    patchJson(request, `/tasks/${encodeURIComponent(taskId)}`, data),
  archiveProject: async (projectId: string, archived: boolean) =>
    patchJson(request, `/projects/${encodeURIComponent(projectId)}/archive`, { archived }),
});
