import { buildTaskTree } from "@todoist-clone/domain";
import { Hono } from "hono";
import { z } from "zod";
import type { TaskRepository } from "./repository";

/** Validates new task fields and supplies default context values. */
const createTaskSchema = z.object({
  /** Title with surrounding whitespace removed. */
  title: z.string().trim().min(1),
  /** Parent task, or the tree root by default. */
  parentId: z.string().nullable().default(null),
  /** Destination project; `null` means the Inbox. */
  projectId: z.string().nullable().default(null),
  /** Destination section, or the default value with no section. */
  sectionId: z.string().nullable().default(null),
});

/** Validates allowed task fields and the integrity of its comment list. */
const patchTaskSchema = z.object({
  /** New task title. */
  title: z.string().trim().min(1).optional(),
  /** Detailed description, limited to the API size constraint. */
  description: z.string().max(20000).optional(),
  /** Due date in YYYY-MM-DD format, or `null` to clear it. */
  dueDate: z.string().date().nullable().optional(),
  /** Complete label list, limited by count and length. */
  labels: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  /** Complete ordered list of comments after editing. */
  comments: z
    .array(
      z.object({
        /** ID of an existing comment; omit it for a new comment. */
        id: z.string().optional(),
        /** Comment text; it may be empty when a file is attached. */
        body: z.string().max(5000),
        /** References to files already uploaded for this comment. */
        attachments: z
          .array(
            z.object({
              /** File UUID in the internal storage. */
              id: z.string(),
              /** File name shown to users and used for downloads. */
              name: z.string(),
              /** File MIME type. */
              mimeType: z.string(),
              /** File size in bytes. */
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

/** Validates the task's new placement and neighboring tasks. */
const moveTaskSchema = z.object({
  /** New parent task, or the tree root. */
  parentId: z.string().nullable().default(null),
  /** Destination project, or the Inbox. */
  projectId: z.string().nullable().default(null),
  /** Destination section, or the list root. */
  sectionId: z.string().nullable().default(null),
  /** ID of the neighboring task to place this task before. */
  beforeId: z.string().nullable().default(null),
  /** ID of the neighboring task to place this task after. */
  afterId: z.string().nullable().default(null),
});

/** Validates a project name and optional parent project reference. */
const createProjectSchema = z.object({
  /** Project title with surrounding whitespace removed. */
  title: z.string().trim().min(1),
  /** Parent project for a new subproject. */
  parentId: z.string().nullable().default(null),
});
/** Validates the parent ID when moving a project. */
const moveProjectSchema = z.object({
  /** New parent project, or `null` to move the project to the root. */
  parentId: z.string().nullable(),
});

/** Accepts only a non-empty update to a project's title and/or description. */
const patchProjectSchema = z
  .object({
    /** New project title. */
    title: z.string().trim().min(1).optional(),
    /** New project description. */
    description: z.string().max(20000).optional(),
  })
  .refine((patch) => patch.title !== undefined || patch.description !== undefined);

/** Identifies the two neighbors between which to place a project or section. */
const reorderProjectSchema = z.object({
  /** Neighbor to place the entity before, or `null`. */
  beforeId: z.string().nullable(),
  /** Neighbor to place the entity after, or `null`. */
  afterId: z.string().nullable(),
});
const reorderSectionSchema = reorderProjectSchema;

/** Validates new section data and its project. */
const createSectionSchema = z.object({
  /** New section title with surrounding whitespace removed. */
  title: z.string().trim().min(1),
  /** Owning project, or `null` for an Inbox section. */
  projectId: z.string().nullable().default(null),
});

/** Validates a new, non-empty section title. */
const patchSectionSchema = z.object({
  /** New section title. */
  title: z.string().trim().min(1),
});

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
    /** Validate the schema before passing HTTP input to the repository. */
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
