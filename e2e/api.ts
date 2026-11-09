import { type APIRequestContext, expect } from "@playwright/test";

const postJson = async <T>(request: APIRequestContext, path: string, data?: unknown): Promise<T> => {
  const response = await request.post(path, data === undefined ? {} : { data });
  const text = await response.text();
  expect(response.ok(), `POST ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

const patchJson = async <T>(request: APIRequestContext, path: string, data: unknown): Promise<T> => {
  const response = await request.patch(path, { data });
  const text = await response.text();
  expect(response.ok(), `PATCH ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

type MultipartValue = string | number | boolean | { name: string; mimeType: string; buffer: Buffer };

const postMultipart = async <T>(
  request: APIRequestContext,
  path: string,
  form: Record<string, MultipartValue>,
): Promise<T> => {
  const response = await request.post(path, { multipart: form });
  const text = await response.text();
  expect(response.ok(), `POST ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

export const createE2eApi = (request: APIRequestContext) =>
  Object.freeze({
    reset: async () => postJson<Readonly<{ reset: true }>>(request, "/api/playwright/reset"),
    clearTable: async (table: "tasks" | "task_comments" | "sections" | "projects") => {
      const response = await request.delete(`/api/playwright/tables/${table}`);
      const text = await response.text();
      expect(response.ok(), `DELETE test table ${table} failed (${response.status()}): ${text}`).toBe(true);
      return JSON.parse(text) as Readonly<{ table: string; deleted: number }>;
    },
    createProject: async (title: string, parentId: string | null = null) => {
      const result = await postJson<Readonly<{ project: Readonly<{ id: string; title: string }> }>>(
        request,
        "/api/playwright/entities/project",
        { title, parentId },
      );
      return result.project;
    },
    createSection: async (title: string, projectId: string | null = null) => {
      const result = await postJson<Readonly<{ section: Readonly<{ id: string; title: string }> }>>(
        request,
        "/api/playwright/entities/section",
        { title, projectId },
      );
      return result.section;
    },
    createTask: async (
      title: string,
      placement: Readonly<{
        projectId?: string | null;
        sectionId?: string | null;
        parentId?: string | null;
      }> = Object.freeze({}),
    ) => {
      const result = await postJson<Readonly<{ task: Readonly<{ id: string; title: string }> }>>(
        request,
        "/api/playwright/entities/task",
        {
          title,
          projectId: placement.projectId ?? null,
          sectionId: placement.sectionId ?? null,
          parentId: placement.parentId ?? null,
        },
      );
      return result.task;
    },
    createComment: async (taskId: string, body: string) => {
      const result = await postJson<Readonly<{ comment: Readonly<{ id: string; body: string }> }>>(
        request,
        "/api/playwright/entities/comment",
        { taskId, body },
      );
      return result.comment;
    },
    createAttachment: async (
      taskId: string,
      file: Readonly<{ name: string; mimeType: string; buffer: Buffer }>,
      body = "",
    ) => {
      const result = await postMultipart<
        Readonly<{
          comment: Readonly<{ id: string }>;
          attachment: Readonly<{ id: string; name: string; size: number }>;
        }>
      >(request, "/api/playwright/entities/attachment", {
        taskId,
        body,
        files: { name: file.name, mimeType: file.mimeType, buffer: file.buffer },
      });
      return result;
    },
    updateTask: async (taskId: string, data: Readonly<Record<string, unknown>>) =>
      patchJson(request, `/tasks/${encodeURIComponent(taskId)}`, data),
    archiveProject: async (projectId: string, archived: boolean) =>
      patchJson(request, `/projects/${encodeURIComponent(projectId)}/archive`, { archived }),
  });
