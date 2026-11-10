import { generateLexicalOrder } from "@todoist-clone/domain";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TaskRepository } from "../repository";
import { firstProject, nullableEq, projectOrder, rowOrder, sectionOrder, toProject } from "./postgresHelpers";
import { projects as projectsTable, sections as sectionsTable, tasks as tasksTable } from "./schema";

export const createPostgresProjectMethods = (
  db: ReturnType<typeof drizzle>,
  client: postgres.Sql,
  userId: string,
): Pick<
  TaskRepository,
  | "listProjects"
  | "createProject"
  | "createSubproject"
  | "moveProject"
  | "reorderProject"
  | "updateProject"
  | "deleteProject"
  | "duplicateProject"
  | "setProjectArchived"
> =>
  Object.freeze({
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
  });
