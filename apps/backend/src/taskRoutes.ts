import { buildTaskTree } from "@todoist-clone/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { TaskRepository } from "./repository";

/** Validates new task fields and supplies default context values.
 * @property {string} title - Task title, trimmed and required to be non-empty.
 * @property {string | null} parentId - Parent task, or the tree root by default.
 * @property {string | null} projectId - Destination project; `null` means the Inbox.
 * @property {string | null} sectionId - Destination section, or the project root by default.
 */
const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  sectionId: z.string().nullable().default(null),
});

/** Validates allowed task fields and the integrity of its comment list.
 * @property {string} [title] - New task title, trimmed and non-empty when supplied.
 * @property {string} [description] - Detailed description, limited to the API size constraint.
 * @property {string | null} [dueDate] - Due date in YYYY-MM-DD format, or `null` to clear it.
 * @property {Array<string>} [labels] - Complete label list, limited by count and length.
 * @property {Array<Object>} [comments] - Complete ordered comment list.
 * @property {string} [comments.id] - Existing comment ID; omit it for a new comment.
 * @property {string} comments.body - Comment text; it may be empty when a file is attached.
 * @property {Array<Object>} [comments.attachments] - References to files already uploaded for the comment.
 * @property {string} comments.attachments.id - File UUID in internal storage.
 * @property {string} comments.attachments.name - File name shown to users and used for downloads.
 * @property {string} comments.attachments.mimeType - File MIME type.
 * @property {number} comments.attachments.size - File size in bytes.
 * @property {boolean} [completed] - New completion status.
 * @property {string | null} [projectId] - Destination project, or `null` for the Inbox.
 * @property {string | null} [sectionId] - Destination section, or `null` for the project root.
 */
const patchTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().max(20000).optional(),
  dueDate: z.string().date().nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  comments: z
    .array(
      z.object({
        id: z.string().optional(),
        body: z.string().max(5000),
        attachments: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              mimeType: z.string(),
              size: z.number(),
            }),
          )
          .optional(),
      }),
    )
    .refine(
      /** A comment without text is allowed only when it has at least one attachment. */
      (comments) =>
        comments.every((comment) => comment.body.trim().length > 0 || (comment.attachments?.length ?? 0) > 0),
      "Comment text or at least one attachment is required",
    )
    .refine(
      /** Duplicate IDs could make an update or deletion target ambiguous. */
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

/** Validates a task's new placement and its neighboring tasks.
 * @property {string | null} parentId - New parent task, or the tree root.
 * @property {string | null} projectId - Destination project, or the Inbox.
 * @property {string | null} sectionId - Destination section, or the project root.
 * @property {string | null} beforeId - ID of the neighboring task to place this task before.
 * @property {string | null} afterId - ID of the neighboring task to place this task after.
 */
const moveTaskSchema = z.object({
  parentId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  sectionId: z.string().nullable().default(null),
  beforeId: z.string().nullable().default(null),
  afterId: z.string().nullable().default(null),
});

/** Validates a project name and optional parent project reference.
 * @property {string} title - Project title with surrounding whitespace removed.
 * @property {string | null} parentId - Parent project for a new subproject.
 */
const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
});
/** Validates the parent ID when moving a project.
 * @property {string | null} parentId - New parent project, or `null` to move the project to the root.
 */
const moveProjectSchema = z.object({
  parentId: z.string().nullable(),
});

/** Accepts only a non-empty update to a project's title and/or description.
 * @property {string} [title] - New project title.
 * @property {string} [description] - New project description.
 */
const patchProjectSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().max(20000).optional(),
  })
  .refine((patch) => patch.title !== undefined || patch.description !== undefined);

/** Identifies the two neighbors between which to place a project or section.
 * @property {string | null} beforeId - Neighbor to place the entity before, or `null`.
 * @property {string | null} afterId - Neighbor to place the entity after, or `null`.
 */
const reorderProjectSchema = z.object({
  beforeId: z.string().nullable(),
  afterId: z.string().nullable(),
});
/** Reuses project neighbor validation for section ordering. */
const reorderSectionSchema = reorderProjectSchema;

/** Validates new section data and its project.
 * @property {string} title - New section title with surrounding whitespace removed.
 * @property {string | null} projectId - Owning project, or `null` for an Inbox section.
 */
const createSectionSchema = z.object({
  title: z.string().trim().min(1),
  projectId: z.string().nullable().default(null),
});

/** Validates a new, non-empty section title.
 * @property {string} title - New section title.
 */
const patchSectionSchema = z.object({
  title: z.string().trim().min(1),
});

/** Validates whether a project should be archived.
 * @property {boolean} archived - Whether the project should be archived.
 */
const archiveProjectSchema = z.object({ archived: z.boolean() });

/**
 * Hono application type containing the authenticated user's data.
 *
 * @typedef {Object} ApplicationHono
 * @property {{ userId: string; authenticated: boolean }} Variables - Request variables available to route handlers.
 * @property {string} Variables.userId - ID of the authenticated user.
 * @property {boolean} Variables.authenticated - Whether the request has an authenticated session.
 */
type ApplicationHono = Hono<{ Variables: { userId: string; authenticated: boolean } }>;
/**
 * Creates a repository scoped to the current user's ID.
 *
 * @typedef {(userId: string) => TaskRepository} RepositoryForUser
 */
type RepositoryForUser = (userId: string) => TaskRepository;

/**
 * Registers HTTP adapters for tasks, projects, and sections.
 *
 * @param {ApplicationHono} app
 * @param {RepositoryForUser} repositoryFor
 * @param {(request: Request) => Promise<unknown>} parseJson
 * @param {boolean} projectArchivingEnabled
 * @param {boolean} attachmentStorageAvailable
 * @param {(ids: Array<string>) => Promise<unknown>} removeAttachments
 * @returns {void}
 */
export const registerTaskRoutes = (
  app: ApplicationHono,
  repositoryFor: RepositoryForUser,
  parseJson: (request: Request) => Promise<unknown>,
  projectArchivingEnabled: boolean,
  attachmentStorageAvailable: boolean,
  removeAttachments: (ids: Array<string>) => Promise<unknown>,
): void => {
  /** Return the flat task list together with the tree built by the domain function. */
  app.get("/tasks", async (context) => {
    const tasks = await repositoryFor(context.get("userId")).list();

    return context.json({ tasks, tree: buildTaskTree(tasks) });
  });

  /** Return projects and sections as separate collections for workspace loading. */
  app.get("/projects", async (context) => {
    const projects = await repositoryFor(context.get("userId")).listProjects();

    return context.json({ projects });
  });

  app.post("/projects", async (context) => {
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
    const result = archiveProjectSchema.safeParse(await parseJson(context.req.raw));
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
    /** Before creating a section, verify that the project belongs to the user. */
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
    /** Validate the parent, project, and section references against the current user's data. */
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
    /** Keep the previous task to validate relationships and clean up removed attachments. */
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
    /** Clients may reuse attachment metadata only from the task's existing comments. */
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

    /** After a successful update, delete attachment files no longer referenced by comments. */
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
    /** The section must belong to the project receiving the task. */
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
