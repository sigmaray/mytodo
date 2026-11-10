import type { Task } from "@todoist-clone/domain";
import { generateLexicalOrder } from "@todoist-clone/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TaskMove, TaskPatch, TaskRepository } from "../repository";
import {
  collectDescendantIds,
  findSiblingOrder,
  firstTask,
  hasValidTaskPlacement,
  normalizeDate,
  rowOrder,
  toComment,
  toTask,
} from "./postgresHelpers";
import {
  projects as projectsTable,
  sections as sectionsTable,
  taskComments as taskCommentsTable,
  tasks as tasksTable,
} from "./schema";

export const createPostgresTaskMethods = (
  db: ReturnType<typeof drizzle>,
  client: postgres.Sql,
  userId: string,
): Pick<TaskRepository, "list" | "create" | "patch" | "addComment" | "move" | "delete"> =>
  Object.freeze({
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
          const existingTasks = await transaction<{ id: string }[]>`
            SELECT id FROM tasks WHERE id = ${id} AND user_id = ${userId} FOR UPDATE
          `;
          if (existingTasks.length === 0) throw new Error("Task not found while updating comments");
          const existingComments = await transaction<
            { id: string; body: string; createdAt: Date; attachments: unknown }[]
          >`SELECT id, body, created_at AS "createdAt", attachments FROM task_comments WHERE task_id = ${id} AND user_id = ${userId}`;
          const existingById = new Map(existingComments.map((comment) => [comment.id, comment]));
          await transaction`DELETE FROM task_comments WHERE task_id = ${id} AND user_id = ${userId}`;
          for (const comment of comments) {
            const previous = comment.id === undefined ? undefined : existingById.get(comment.id);
            const commentId = previous?.id ?? crypto.randomUUID();
            const createdAt =
              previous === undefined ? new Date().toISOString() : normalizeDate(previous.createdAt);
            const attachments = comment.attachments ?? previous?.attachments ?? [];
            await transaction`INSERT INTO task_comments (id, task_id, user_id, body, created_at, attachments) VALUES (${commentId}, ${id}, ${userId}, ${comment.body}, ${createdAt}, ${JSON.stringify(attachments)}::jsonb)`;
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
