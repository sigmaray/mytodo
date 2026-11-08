import type { Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";
import { generateLexicalOrder } from "@todoist-clone/domain";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TaskMove, TaskPatch, TaskRepository } from "../repository";
import {
  projects as projectsTable,
  sections as sectionsTable,
  taskComments as taskCommentsTable,
  tasks as tasksTable,
} from "./schema";

type TaskRow = typeof tasksTable.$inferSelect;
type TaskCommentRow = typeof taskCommentsTable.$inferSelect;
type ProjectRow = typeof projectsTable.$inferSelect;
type SectionRow = typeof sectionsTable.$inferSelect;

const normalizeDate = (value: Date | string): string =>
  typeof value === "string" ? new Date(value).toISOString() : value.toISOString();

const toTask = (row: TaskRow, comments: ReadonlyArray<Task["comments"][number]> = Object.freeze([])): Task =>
  Object.freeze({
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    labels: Object.freeze(row.labels),
    comments: Object.freeze([...comments]),
    completed: row.completed,
    parentId: row.parentId,
    projectId: row.projectId,
    sectionId: row.sectionId,
    lexicalOrder: row.lexicalOrder,
    createdAt: normalizeDate(row.createdAt),
    updatedAt: normalizeDate(row.updatedAt),
  });

const toProject = (row: ProjectRow): Project =>
  Object.freeze({
    id: row.id,
    title: row.title,
    description: row.description,
    archived: row.archived,
    parentId: row.parentId,
    lexicalOrder: row.lexicalOrder,
    createdAt: normalizeDate(row.createdAt),
    updatedAt: normalizeDate(row.updatedAt),
  });

const toSection = (row: SectionRow): Section =>
  Object.freeze({
    id: row.id,
    title: row.title,
    projectId: row.projectId,
    lexicalOrder: row.lexicalOrder,
    createdAt: normalizeDate(row.createdAt),
    updatedAt: normalizeDate(row.updatedAt),
  });

const rowOrder = asc(sql`${tasksTable.lexicalOrder} COLLATE "C"`);
const projectOrder = asc(sql`${projectsTable.lexicalOrder} COLLATE "C"`);
const sectionOrder = asc(sql`${sectionsTable.lexicalOrder} COLLATE "C"`);

const nullableEq = <TColumn>(column: TColumn, value: string | null) =>
  value === null ? isNull(column as never) : eq(column as never, value);

const hasValidTaskPlacement = async (
  db: ReturnType<typeof drizzle>,
  userId: string,
  projectId: string | null,
  sectionId: string | null,
): Promise<boolean> => {
  if (sectionId === null) return true;
  const [section] = await db
    .select({ projectId: sectionsTable.projectId })
    .from(sectionsTable)
    .where(and(eq(sectionsTable.id, sectionId), eq(sectionsTable.userId, userId)))
    .limit(1);
  return section !== undefined && section.projectId === projectId;
};

const findSiblingOrder = async (
  db: ReturnType<typeof drizzle>,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
  beforeId: TaskId | null,
  afterId: TaskId | null,
  userId: string,
) => {
  const siblings = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, userId),
        nullableEq(tasksTable.parentId, parentId),
        nullableEq(tasksTable.projectId, projectId),
        nullableEq(tasksTable.sectionId, sectionId),
      ),
    )
    .orderBy(rowOrder);
  const successorIndex = beforeId === null ? -1 : siblings.findIndex((task) => task.id === beforeId);
  const predecessorIndex = afterId === null ? -1 : siblings.findIndex((task) => task.id === afterId);
  const low =
    predecessorIndex >= 0
      ? (siblings[predecessorIndex]?.lexicalOrder ?? null)
      : beforeId === null && afterId === null
        ? (siblings.at(-1)?.lexicalOrder ?? null)
        : null;
  const high = successorIndex >= 0 ? (siblings[successorIndex]?.lexicalOrder ?? null) : null;

  return generateLexicalOrder(low, high);
};

const collectDescendantIds = async (
  db: ReturnType<typeof drizzle>,
  id: TaskId,
  userId: string,
): Promise<ReadonlyArray<TaskId>> => {
  const children = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.parentId, id), eq(tasksTable.userId, userId)));
  const descendantIds = await Promise.all(
    children.map((child) => collectDescendantIds(db, child.id, userId)),
  );

  return Object.freeze([id, ...descendantIds.flat()]);
};

const firstTask = (rows: ReadonlyArray<TaskRow>) => (rows[0] === undefined ? null : toTask(rows[0]));
const toComment = (row: TaskCommentRow): Task["comments"][number] =>
  Object.freeze({
    id: row.id,
    body: row.body,
    createdAt: normalizeDate(row.createdAt),
    ...(Array.isArray(row.attachments) && row.attachments.length > 0
      ? {
          attachments: Object.freeze(row.attachments as NonNullable<Task["comments"][number]["attachments"]>),
        }
      : {}),
  });
const firstProject = (rows: ReadonlyArray<ProjectRow>) => (rows[0] === undefined ? null : toProject(rows[0]));
const firstSection = (rows: ReadonlyArray<SectionRow>) => (rows[0] === undefined ? null : toSection(rows[0]));

export const createPostgresTaskRepository = (
  databaseUrl: string,
  userId = "legacy-admin",
  sharedClient?: postgres.Sql,
): TaskRepository => {
  const client = sharedClient ?? postgres(databaseUrl, { max: 10 });
  const db = drizzle(client);

  return Object.freeze({
    list: async () => {
      const rows = await db.select().from(tasksTable).where(eq(tasksTable.userId, userId)).orderBy(rowOrder);
      const taskIds = rows.map((row) => row.id);
      const commentRows =
        taskIds.length === 0
          ? []
          : await db
              .select()
              .from(taskCommentsTable)
              .where(and(eq(taskCommentsTable.userId, userId), inArray(taskCommentsTable.taskId, taskIds)))
              .orderBy(asc(taskCommentsTable.createdAt), asc(taskCommentsTable.id));
      const commentsByTask = commentRows.reduce(
        (result, row) => ({ ...result, [row.taskId]: [...(result[row.taskId] ?? []), toComment(row)] }),
        {} as Record<string, ReadonlyArray<Task["comments"][number]>>,
      );
      return Object.freeze(rows.map((row) => toTask(row, commentsByTask[row.id] ?? Object.freeze([]))));
    },
    listProjects: async () => {
      const rows = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.userId, userId))
        .orderBy(projectOrder);

      return Object.freeze(rows.map(toProject));
    },
    createProject: async (title) => {
      const siblings = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.userId, userId), isNull(projectsTable.parentId)))
        .orderBy(projectOrder);
      const rows = await db
        .insert(projectsTable)
        .values({
          id: crypto.randomUUID(),
          userId,
          title,
          archived: false,
          parentId: null,
          lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        })
        .returning();
      const project = firstProject(rows);

      if (project === null) {
        throw new Error("Project insert failed");
      }

      return project;
    },
    createSubproject: async (title, parentId) => {
      const parent = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(and(eq(projectsTable.id, parentId), eq(projectsTable.userId, userId)))
        .limit(1);
      if (parent.length === 0) throw new Error("Parent project not found");
      const siblings = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.parentId, parentId), eq(projectsTable.userId, userId)))
        .orderBy(projectOrder);
      const rows = await db
        .insert(projectsTable)
        .values({
          id: crypto.randomUUID(),
          userId,
          title,
          parentId,
          archived: false,
          lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        })
        .returning();
      const project = firstProject(rows);
      if (project === null) throw new Error("Project insert failed");
      return project;
    },
    moveProject: async (id, parentId) => {
      if (parentId === id) return null;
      if (parentId !== null) {
        const rows = await db.select().from(projectsTable).where(eq(projectsTable.userId, userId));
        if (!rows.some((project) => project.id === parentId)) return null;
        let ancestor: string | null = parentId;
        while (ancestor !== null) {
          if (ancestor === id) return null;
          ancestor = rows.find((project) => project.id === ancestor)?.parentId ?? null;
        }
      }
      const existingRows = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
        .limit(1);
      const existing = existingRows[0];
      if (existing === undefined) return null;
      const siblings = await db
        .select()
        .from(projectsTable)
        .where(and(nullableEq(projectsTable.parentId, parentId), eq(projectsTable.userId, userId)))
        .orderBy(projectOrder);
      const rows = await db
        .update(projectsTable)
        .set({
          parentId,
          lexicalOrder: generateLexicalOrder(
            siblings.filter((project) => project.id !== id).at(-1)?.lexicalOrder ?? null,
            null,
          ),
          updatedAt: new Date(),
        })
        .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
        .returning();
      return firstProject(rows);
    },
    reorderProject: async (id, beforeId, afterId) => {
      const existingRows = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
        .limit(1);
      const existing = existingRows[0];
      if (existing === undefined) return null;
      const siblings = (
        await db
          .select()
          .from(projectsTable)
          .where(and(nullableEq(projectsTable.parentId, existing.parentId), eq(projectsTable.userId, userId)))
          .orderBy(projectOrder)
      ).filter((project) => project.id !== id);
      const beforeIndex = beforeId === null ? -1 : siblings.findIndex((project) => project.id === beforeId);
      const afterIndex = afterId === null ? -1 : siblings.findIndex((project) => project.id === afterId);
      const low =
        afterIndex >= 0
          ? (siblings[afterIndex]?.lexicalOrder ?? null)
          : beforeId === null && afterId === null
            ? (siblings.at(-1)?.lexicalOrder ?? null)
            : null;
      const high = beforeIndex >= 0 ? (siblings[beforeIndex]?.lexicalOrder ?? null) : null;
      const rows = await db
        .update(projectsTable)
        .set({ lexicalOrder: generateLexicalOrder(low, high), updatedAt: new Date() })
        .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
        .returning();
      return firstProject(rows);
    },
    updateProject: async (id, patch) => {
      const rows = await db
        .update(projectsTable)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
        .returning();

      return firstProject(rows);
    },
    deleteProject: async (id) => {
      return client.begin(async (transaction) => {
        const projectRows = await transaction<
          { parentId: string | null }[]
        >`SELECT parent_id AS "parentId" FROM projects WHERE id = ${id} AND user_id = ${userId} LIMIT 1`;
        const project = projectRows[0];
        if (project === undefined) return false;
        const descendants = await transaction<{ id: string }[]>`
          WITH RECURSIVE doomed(id) AS (
            SELECT task.id FROM tasks AS task
            WHERE task.user_id = ${userId}
              AND (task.project_id = ${id} OR task.section_id IN (SELECT section.id FROM sections AS section WHERE section.project_id = ${id} AND section.user_id = ${userId}))
            UNION
            SELECT child.id FROM tasks AS child JOIN doomed AS parent ON child.parent_id = parent.id WHERE child.user_id = ${userId}
          ) SELECT id FROM doomed
        `;
        const doomedIds = Object.freeze(descendants.map((row) => row.id));
        if (doomedIds.length > 0)
          await transaction`DELETE FROM tasks WHERE user_id = ${userId} AND id = ANY(${transaction.array([...doomedIds])})`;
        await transaction`DELETE FROM sections WHERE project_id = ${id} AND user_id = ${userId}`;
        await transaction`UPDATE projects SET parent_id = ${project.parentId}, updated_at = now() WHERE parent_id = ${id} AND user_id = ${userId}`;
        const deleted = await transaction<
          { id: string }[]
        >`DELETE FROM projects WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
        return deleted.length > 0;
      });
    },
    duplicateProject: async (id) => {
      const projectRows = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
        .limit(1);
      const source = projectRows[0];
      if (source === undefined) return null;
      const sourceSections = await db
        .select()
        .from(sectionsTable)
        .where(and(eq(sectionsTable.projectId, id), eq(sectionsTable.userId, userId)))
        .orderBy(sectionOrder);
      const sourceTasks = await db
        .select()
        .from(tasksTable)
        .where(and(eq(tasksTable.projectId, id), eq(tasksTable.userId, userId)))
        .orderBy(rowOrder);
      const createdAt = new Date();
      const newProjectId = crypto.randomUUID();
      const copiedProject = await db
        .insert(projectsTable)
        .values({
          id: newProjectId,
          userId,
          title: `${source.title} copy`,
          description: source.description,
          archived: false,
          parentId: source.parentId,
          lexicalOrder: generateLexicalOrder(source.lexicalOrder, null),
        })
        .returning();
      const sectionMap = new Map(sourceSections.map((section) => [section.id, crypto.randomUUID()]));
      if (sourceSections.length)
        await db.insert(sectionsTable).values(
          sourceSections.map((section) => ({
            id: sectionMap.get(section.id)!,
            userId,
            title: section.title,
            projectId: newProjectId,
            lexicalOrder: section.lexicalOrder,
          })),
        );
      const taskMap = new Map(sourceTasks.map((task) => [task.id, crypto.randomUUID()]));
      if (sourceTasks.length)
        await db.insert(tasksTable).values(
          sourceTasks.map((task) => ({
            ...task,
            id: taskMap.get(task.id)!,
            userId,
            projectId: newProjectId,
            sectionId: task.sectionId === null ? null : (sectionMap.get(task.sectionId) ?? null),
            parentId: task.parentId === null ? null : (taskMap.get(task.parentId) ?? null),
            createdAt,
            updatedAt: createdAt,
          })),
        );
      const project = copiedProject[0];
      return project === undefined ? null : toProject(project);
    },
    setProjectArchived: async (id, archived) => {
      const rows = await db
        .update(projectsTable)
        .set({ archived, updatedAt: new Date() })
        .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
        .returning();
      return firstProject(rows);
    },
    listSections: async () => {
      const rows = await db
        .select()
        .from(sectionsTable)
        .where(eq(sectionsTable.userId, userId))
        .orderBy(sectionOrder);

      return Object.freeze(rows.map(toSection));
    },
    reorderSection: async (id, beforeId, afterId) => {
      const current = await db
        .select()
        .from(sectionsTable)
        .where(and(eq(sectionsTable.id, id), eq(sectionsTable.userId, userId)));
      const section = current[0];
      if (!section) return null;
      const ordered = await db
        .select()
        .from(sectionsTable)
        .where(and(nullableEq(sectionsTable.projectId, section.projectId), eq(sectionsTable.userId, userId)))
        .orderBy(sectionOrder);
      const siblings = ordered.filter((item) => item.id !== id);
      const beforeIndex = beforeId === null ? -1 : siblings.findIndex((item) => item.id === beforeId);
      const afterIndex = afterId === null ? -1 : siblings.findIndex((item) => item.id === afterId);
      const low =
        afterIndex >= 0
          ? (siblings[afterIndex]?.lexicalOrder ?? null)
          : beforeId === null && afterId === null
            ? (siblings.at(-1)?.lexicalOrder ?? null)
            : null;
      const high = beforeIndex >= 0 ? (siblings[beforeIndex]?.lexicalOrder ?? null) : null;
      const rows = await db
        .update(sectionsTable)
        .set({ lexicalOrder: generateLexicalOrder(low, high), updatedAt: new Date() })
        .where(and(eq(sectionsTable.id, id), eq(sectionsTable.userId, userId)))
        .returning();
      return firstSection(rows);
    },
    createSection: async (title, projectId) => {
      if (
        projectId !== null &&
        (
          await db
            .select({ id: projectsTable.id })
            .from(projectsTable)
            .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)))
            .limit(1)
        ).length === 0
      )
        throw new Error("Project not found");
      const siblings = await db
        .select()
        .from(sectionsTable)
        .where(and(nullableEq(sectionsTable.projectId, projectId), eq(sectionsTable.userId, userId)))
        .orderBy(sectionOrder);
      const rows = await db
        .insert(sectionsTable)
        .values({
          id: crypto.randomUUID(),
          userId,
          title,
          projectId,
          lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        })
        .returning();
      const section = firstSection(rows);

      if (section === null) {
        throw new Error("Section insert failed");
      }

      return section;
    },
    updateSection: async (id, title) => {
      const rows = await db
        .update(sectionsTable)
        .set({
          title,
          updatedAt: new Date(),
        })
        .where(and(eq(sectionsTable.id, id), eq(sectionsTable.userId, userId)))
        .returning();

      return firstSection(rows);
    },
    deleteSection: async (id) => {
      return client.begin(async (transaction) => {
        const existing = await transaction<
          { id: string }[]
        >`SELECT id FROM sections WHERE id = ${id} AND user_id = ${userId} LIMIT 1`;
        if (existing.length === 0) return false;
        await transaction`UPDATE tasks SET parent_id = NULL, section_id = NULL, updated_at = now() WHERE section_id = ${id} AND user_id = ${userId}`;
        const deleted = await transaction<
          { id: string }[]
        >`DELETE FROM sections WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
        return deleted.length > 0;
      });
    },
    create: async (title, parentId, projectId, sectionId) => {
      if (
        parentId !== null &&
        (
          await db
            .select({ id: tasksTable.id })
            .from(tasksTable)
            .where(and(eq(tasksTable.id, parentId), eq(tasksTable.userId, userId)))
            .limit(1)
        ).length === 0
      )
        throw new Error("Parent task not found");
      if (
        projectId !== null &&
        (
          await db
            .select({ id: projectsTable.id })
            .from(projectsTable)
            .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)))
            .limit(1)
        ).length === 0
      )
        throw new Error("Project not found");
      if (
        sectionId !== null &&
        (
          await db
            .select({ id: sectionsTable.id })
            .from(sectionsTable)
            .where(and(eq(sectionsTable.id, sectionId), eq(sectionsTable.userId, userId)))
            .limit(1)
        ).length === 0
      )
        throw new Error("Section not found");
      if (!(await hasValidTaskPlacement(db, userId, projectId, sectionId)))
        throw new Error("Section does not belong to project");
      const id = crypto.randomUUID();
      const lexicalOrder = await findSiblingOrder(db, parentId, projectId, sectionId, null, null, userId);
      const rows = await db
        .insert(tasksTable)
        .values({
          id,
          userId,
          title,
          completed: false,
          parentId,
          projectId,
          sectionId,
          lexicalOrder,
        })
        .returning();

      const task = firstTask(rows);

      if (task === null) {
        throw new Error("Task insert failed");
      }

      return task;
    },
    patch: async (id, patch: TaskPatch) => {
      const [currentTask] = await db
        .select({ projectId: tasksTable.projectId, sectionId: tasksTable.sectionId })
        .from(tasksTable)
        .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)))
        .limit(1);
      if (currentTask === undefined) return null;
      const nextProjectId = patch.projectId === undefined ? currentTask.projectId : patch.projectId;
      const nextSectionId = patch.sectionId === undefined ? currentTask.sectionId : patch.sectionId;
      if (!(await hasValidTaskPlacement(db, userId, nextProjectId, nextSectionId))) return null;
      if (
        patch.projectId != null &&
        (
          await db
            .select({ id: projectsTable.id })
            .from(projectsTable)
            .where(and(eq(projectsTable.id, patch.projectId), eq(projectsTable.userId, userId)))
            .limit(1)
        ).length === 0
      )
        return null;
      if (
        patch.sectionId != null &&
        (
          await db
            .select({ id: sectionsTable.id })
            .from(sectionsTable)
            .where(and(eq(sectionsTable.id, patch.sectionId), eq(sectionsTable.userId, userId)))
            .limit(1)
        ).length === 0
      )
        return null;
      const { comments, ...taskPatch } = patch;
      const rows = await db
        .update(tasksTable)
        .set({
          ...taskPatch,
          labels: taskPatch.labels === undefined ? undefined : [...taskPatch.labels],
          updatedAt: new Date(),
        })
        .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)))
        .returning();
      const taskRow = rows[0];
      if (taskRow === undefined) return null;
      if (comments !== undefined) {
        await client.begin(async (transaction) => {
          const existing = await transaction<
            { id: string }[]
          >`SELECT id FROM tasks WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
          if (existing.length === 0) throw new Error("Task not found while updating comments");
          await transaction`DELETE FROM task_comments WHERE task_id = ${id} AND user_id = ${userId}`;
          for (const comment of comments) {
            await transaction`INSERT INTO task_comments (id, task_id, user_id, body, created_at, attachments) VALUES (${comment.id}, ${id}, ${userId}, ${comment.body}, ${comment.createdAt}, ${JSON.stringify(comment.attachments ?? [])}::jsonb)`;
          }
        });
      }
      const commentRows = await db
        .select()
        .from(taskCommentsTable)
        .where(and(eq(taskCommentsTable.taskId, id), eq(taskCommentsTable.userId, userId)))
        .orderBy(asc(taskCommentsTable.createdAt), asc(taskCommentsTable.id));
      return toTask(taskRow, commentRows.map(toComment));
    },
    addComment: async (id, comment) =>
      client.begin(async (transaction) => {
        const existing = await transaction<
          { id: string }[]
        >`SELECT id FROM tasks WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
        if (existing.length === 0) return false;
        await transaction`INSERT INTO task_comments (id, task_id, user_id, body, created_at, attachments) VALUES (${comment.id}, ${id}, ${userId}, ${comment.body}, ${comment.createdAt}, ${JSON.stringify(comment.attachments ?? [])}::jsonb)`;
        await transaction`UPDATE tasks SET updated_at = now() WHERE id = ${id} AND user_id = ${userId}`;
        return true;
      }),
    move: async (id, move: TaskMove) => {
      const movedId = await client.begin(async (transaction) => {
        await transaction`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        const taskRows = await transaction<
          { id: string; parentId: string | null }[]
        >`SELECT id, parent_id AS "parentId" FROM tasks WHERE user_id = ${userId}`;
        if (!taskRows.some((task) => task.id === id)) return null;
        if (move.parentId !== null && !taskRows.some((task) => task.id === move.parentId)) return null;
        const wouldCreateCycle = (ancestorId: string | null, visited: ReadonlyArray<string>): boolean => {
          if (ancestorId === null) return false;
          if (ancestorId === id || visited.includes(ancestorId)) return true;
          return wouldCreateCycle(
            taskRows.find((task) => task.id === ancestorId)?.parentId ?? null,
            Object.freeze([...visited, ancestorId]),
          );
        };
        if (wouldCreateCycle(move.parentId, Object.freeze([]))) return null;
        if (
          move.projectId !== null &&
          (
            await transaction<
              { id: string }[]
            >`SELECT id FROM projects WHERE id = ${move.projectId} AND user_id = ${userId} LIMIT 1`
          ).length === 0
        )
          return null;
        if (
          move.sectionId !== null &&
          (
            await transaction<
              { id: string }[]
            >`SELECT id FROM sections WHERE id = ${move.sectionId} AND user_id = ${userId} LIMIT 1`
          ).length === 0
        )
          return null;
        if (move.sectionId !== null) {
          const sectionRows = await transaction<{ projectId: string | null }[]>`
            SELECT project_id AS "projectId" FROM sections WHERE id = ${move.sectionId} AND user_id = ${userId} LIMIT 1
          `;
          if (sectionRows[0]?.projectId !== move.projectId) return null;
        }
        const siblings = await transaction<{ id: string; lexicalOrder: string }[]>`
          SELECT id, lexical_order AS "lexicalOrder" FROM tasks
          WHERE user_id = ${userId} AND id <> ${id}
            AND parent_id IS NOT DISTINCT FROM ${move.parentId}
            AND project_id IS NOT DISTINCT FROM ${move.projectId}
            AND section_id IS NOT DISTINCT FROM ${move.sectionId}
          ORDER BY lexical_order COLLATE "C"
        `;
        const beforeIndex =
          move.beforeId === null ? -1 : siblings.findIndex((task) => task.id === move.beforeId);
        const afterIndex =
          move.afterId === null ? -1 : siblings.findIndex((task) => task.id === move.afterId);
        const low =
          afterIndex >= 0
            ? (siblings[afterIndex]?.lexicalOrder ?? null)
            : move.beforeId === null && move.afterId === null
              ? (siblings.at(-1)?.lexicalOrder ?? null)
              : null;
        const high = beforeIndex >= 0 ? (siblings[beforeIndex]?.lexicalOrder ?? null) : null;
        const lexicalOrder = generateLexicalOrder(low, high);
        const rows = await transaction<{ id: string }[]>`
          UPDATE tasks SET parent_id = ${move.parentId}, project_id = ${move.projectId}, section_id = ${move.sectionId}, lexical_order = ${lexicalOrder}, updated_at = now()
          WHERE id = ${id} AND user_id = ${userId} RETURNING id
        `;
        return rows[0]?.id ?? null;
      });
      if (movedId === null) return null;
      const rows = await db
        .select()
        .from(tasksTable)
        .where(and(eq(tasksTable.id, movedId), eq(tasksTable.userId, userId)))
        .limit(1);
      return firstTask(rows);
    },
    delete: async (id) => {
      const deletedIds = await collectDescendantIds(db, id, userId);

      if (deletedIds.length === 0) {
        return false;
      }

      const rows = await db
        .delete(tasksTable)
        .where(and(inArray(tasksTable.id, [...deletedIds]), eq(tasksTable.userId, userId)))
        .returning({ id: tasksTable.id });

      return rows.length > 0;
    },
  });
};

export const createPostgresTaskRepositoryFactory = (databaseUrl: string) => {
  const sharedClient = postgres(databaseUrl, { max: 10 });
  let repositories = Object.freeze({} as Readonly<Record<string, TaskRepository>>);
  return (userId: string): TaskRepository => {
    const existing = repositories[userId];
    if (existing !== undefined) return existing;
    const created = createPostgresTaskRepository(databaseUrl, userId, sharedClient);
    repositories = Object.freeze({ ...repositories, [userId]: created });
    return created;
  };
};
