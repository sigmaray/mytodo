import { type APIRequestContext, expect } from "@playwright/test";

/**
 * Sends a JSON POST and includes the response body in assertion errors.
 *
 * @param {APIRequestContext} request
 * @param {string} path
 * @param {unknown} [data]
 * @returns {Promise<T>}
 */
const postJson = async <T>(request: APIRequestContext, path: string, data?: unknown): Promise<T> => {
  /** Send an empty request when no body is supplied instead of sending JSON null. */
  const response = await request.post(path, data === undefined ? {} : { data });
  /** Read the body once and include it in the error message to diagnose failed requests. */
  const text = await response.text();
  expect(response.ok(), `POST ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

/**
 * Sends a JSON PATCH and parses the response after validating its HTTP status.
 *
 * @param {APIRequestContext} request
 * @param {string} path
 * @param {unknown} data
 * @returns {Promise<T>}
 */
const patchJson = async <T>(request: APIRequestContext, path: string, data: unknown): Promise<T> => {
  const response = await request.patch(path, { data });
  /** Preserve the response text for assertion errors, then parse it as JSON. */
  const text = await response.text();
  expect(response.ok(), `PATCH ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

/**
 * Allowed field values when building a Playwright multipart request.
 *
 * @typedef {Object} MultipartValue
 * @property {string} name - File name.
 * @property {string} mimeType - File MIME type.
 * @property {Buffer} buffer - File contents.
 */
type MultipartValue =
  | string
  | number
  | boolean
  | {
      name: string;

      mimeType: string;

      buffer: Buffer;
    };

/**
 * Sends a multipart form, validates the response, and returns the JSON result.
 *
 * @param {APIRequestContext} request
 * @param {string} path
 * @param {Record<string, MultipartValue>} form
 * @returns {Promise<T>}
 */
const postMultipart = async <T>(
  request: APIRequestContext,
  path: string,
  form: Record<string, MultipartValue>,
): Promise<T> => {
  const response = await request.post(path, { multipart: form });
  /** Validate multipart responses like JSON responses and include their text in error messages. */
  const text = await response.text();
  expect(response.ok(), `POST ${path} failed (${response.status()}): ${text}`).toBe(true);
  return JSON.parse(text) as T;
};

/**
 * Creates API helpers for preparing E2E data.
 *
 * @param {APIRequestContext} request
 */
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
      projectId?: string | null;

      sectionId?: string | null;

      parentId?: string | null;
    } = {},
  ) => {
    const result = await postJson<{ task: { id: string; title: string } }>(
      request,
      "/api/playwright/entities/task",
      {
        title,
        /** Fill missing placement fields with the API's consistent nullable values. */
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
      name: string;

      mimeType: string;

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
