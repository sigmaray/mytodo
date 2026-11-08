import { expect, type APIRequestContext } from "@playwright/test";

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

export const createE2eApi = (request: APIRequestContext) => Object.freeze({
  reset: async () => postJson<Readonly<{ reset: true }>>(request, "/api/playwright/reset"),
  createProject: async (title: string, parentId: string | null = null) => {
    const result = await postJson<Readonly<{ project: Readonly<{ id: string; title: string }> }>>(request, "/projects", { title, parentId });
    return result.project;
  },
  createSection: async (title: string, projectId: string | null = null) => {
    const result = await postJson<Readonly<{ section: Readonly<{ id: string; title: string }> }>>(request, "/sections", { title, projectId });
    return result.section;
  },
  createTask: async (title: string, placement: Readonly<{ projectId?: string | null; sectionId?: string | null; parentId?: string | null }> = Object.freeze({})) => {
    const result = await postJson<Readonly<{ task: Readonly<{ id: string; title: string }> }>>(request, "/tasks", {
      title,
      projectId: placement.projectId ?? null,
      sectionId: placement.sectionId ?? null,
      parentId: placement.parentId ?? null
    });
    return result.task;
  },
  updateTask: async (taskId: string, data: Readonly<Record<string, unknown>>) => patchJson(request, `/tasks/${encodeURIComponent(taskId)}`, data),
  archiveProject: async (projectId: string, archived: boolean) => patchJson(request, `/projects/${encodeURIComponent(projectId)}/archive`, { archived })
});
