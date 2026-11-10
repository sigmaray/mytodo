import { generateLexicalOrder } from "@todoist-clone/domain";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TaskRepository } from "../repository";
import { firstSection, nullableEq, sectionOrder, toSection } from "./postgresHelpers";
import { projects as projectsTable, sections as sectionsTable } from "./schema";

export const createPostgresSectionMethods = (
  db: ReturnType<typeof drizzle>,
  client: postgres.Sql,
  userId: string,
): Pick<
  TaskRepository,
  "listSections" | "reorderSection" | "createSection" | "updateSection" | "deleteSection"
> =>
  Object.freeze({
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
  });
