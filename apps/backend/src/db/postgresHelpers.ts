import type { Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";
import { generateLexicalOrder } from "@todoist-clone/domain";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  projects as projectsTable,
  sections as sectionsTable,
  taskComments as taskCommentsTable,
  tasks as tasksTable,
} from "./schema";

/**
 * Shape of a task row returned by Drizzle from PostgreSQL.
 *
 * @typedef {typeof tasksTable.$inferSelect} TaskRow
 */
type TaskRow = typeof tasksTable.$inferSelect;
/**
 * Shape of a comment row from the comments table.
 *
 * @typedef {typeof taskCommentsTable.$inferSelect} TaskCommentRow
 */
type TaskCommentRow = typeof taskCommentsTable.$inferSelect;
/**
 * Shape of a project row from the projects table.
 *
 * @typedef {typeof projectsTable.$inferSelect} ProjectRow
 */
type ProjectRow = typeof projectsTable.$inferSelect;
/**
 * Shape of a section row from the sections table.
 *
 * @typedef {typeof sectionsTable.$inferSelect} SectionRow
 */
type SectionRow = typeof sectionsTable.$inferSelect;

/**
 * Converts a driver date value to the ISO format used by the domain model.
 *
 * @param {Date | string} value
 * @returns {string}
 */
export const normalizeDate = (value: Date | string): string =>
  typeof value === "string" ? new Date(value).toISOString() : value.toISOString();

/**
 * Converts a PostgreSQL row to the public task model.
 *
 * @param {TaskRow} row
 * @param {Array<Task["comments"][number]>} [comments]
 * @returns {Task}
 */
export const toTask = (row: TaskRow, comments: Array<Task["comments"][number]> = []): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  dueDate: row.dueDate,
  labels: row.labels,
  comments: [...comments],
  completed: row.completed,
  parentId: row.parentId,
  projectId: row.projectId,
  sectionId: row.sectionId,
  lexicalOrder: row.lexicalOrder,
  createdAt: normalizeDate(row.createdAt),
  updatedAt: normalizeDate(row.updatedAt),
});

/**
 * Converts a PostgreSQL row to the project domain model.
 *
 * @param {ProjectRow} row
 * @returns {Project}
 */
export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  title: row.title,
  description: row.description,
  archived: row.archived,
  parentId: row.parentId,
  lexicalOrder: row.lexicalOrder,
  createdAt: normalizeDate(row.createdAt),
  updatedAt: normalizeDate(row.updatedAt),
});

/**
 * Converts a PostgreSQL row to the section domain model.
 *
 * @param {SectionRow} row
 * @returns {Section}
 */
export const toSection = (row: SectionRow): Section => ({
  id: row.id,
  title: row.title,
  projectId: row.projectId,
  lexicalOrder: row.lexicalOrder,
  createdAt: normalizeDate(row.createdAt),
  updatedAt: normalizeDate(row.updatedAt),
});

/** SQL ordering for tasks by the ASCII order of the lexicalOrder key. */
export const rowOrder = asc(sql`${tasksTable.lexicalOrder} COLLATE "C"`);
/** SQL ordering for projects using the same order as the domain logic. */
export const projectOrder = asc(sql`${projectsTable.lexicalOrder} COLLATE "C"`);
/** SQL ordering for sections by their lexical key. */
export const sectionOrder = asc(sql`${sectionsTable.lexicalOrder} COLLATE "C"`);

/**
 * Builds an equality condition that supports both string values and SQL NULL.
 *
 * @param {TColumn} column
 * @param {string | null} value
 */
export const nullableEq = <TColumn>(column: TColumn, value: string | null) =>
  value === null ? isNull(column as never) : eq(column as never, value);

/**
 * Checks that a section belongs to the same project and user as a task.
 *
 * @param {ReturnType<typeof drizzle>} db
 * @param {string} userId
 * @param {string | null} projectId
 * @param {string | null} sectionId
 * @returns {Promise<boolean>}
 */
export const hasValidTaskPlacement = async (
  db: ReturnType<typeof drizzle>,
  userId: string,
  projectId: string | null,
  sectionId: string | null,
): Promise<boolean> => {
  /** A missing section is allowed for a project root or the Inbox. */
  if (sectionId === null) return true;
  const [section] = await db
    .select({ projectId: sectionsTable.projectId })
    .from(sectionsTable)
    .where(and(eq(sectionsTable.id, sectionId), eq(sectionsTable.userId, userId)))
    .limit(1);
  return section !== undefined && section.projectId === projectId;
};

/**
 * Computes a task's lexical key between the specified neighbors.
 *
 * @param {ReturnType<typeof drizzle>} db
 * @param {TaskId | null} parentId
 * @param {ProjectId | null} projectId
 * @param {SectionId | null} sectionId
 * @param {TaskId | null} beforeId
 * @param {TaskId | null} afterId
 * @param {string} userId
 * @returns The computed lexical key.
 */
export const findSiblingOrder = async (
  db: ReturnType<typeof drizzle>,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
  beforeId: TaskId | null,
  afterId: TaskId | null,
  userId: string,
) => {
  /** Use only neighbors belonging to the same user, nesting level, and project list. */
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
  /** A missing neighbor does not set a boundary; with no neighbors, append the new item. */
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

/**
 * Recursively collects a task ID and all descendant IDs for cascading operations.
 *
 * @param {ReturnType<typeof drizzle>} db
 * @param {TaskId} id
 * @param {string} userId
 * @returns {Promise<Array<TaskId>>}
 */
export const collectDescendantIds = async (
  db: ReturnType<typeof drizzle>,
  id: TaskId,
  userId: string,
): Promise<Array<TaskId>> => {
  /** Search only this user's tasks to preserve the data ownership boundary. */
  const children = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.parentId, id), eq(tasksTable.userId, userId)));
  const descendantIds = await Promise.all(
    children.map((child) => collectDescendantIds(db, child.id, userId)),
  );

  return [id, ...descendantIds.flat()];
};

/**
 * Converts the first result row to a task, or returns `null` when there are no rows.
 *
 * @param {Array<TaskRow>} rows
 */
export const firstTask = (rows: Array<TaskRow>) => (rows[0] === undefined ? null : toTask(rows[0]));
/**
 * Converts a database row to the comment domain model.
 *
 * @param {TaskCommentRow} row
 * @returns {Task["comments"][number]}
 */
export const toComment = (row: TaskCommentRow): Task["comments"][number] => ({
  id: row.id,
  body: row.body,
  createdAt: normalizeDate(row.createdAt),
  ...(Array.isArray(row.attachments) && row.attachments.length > 0
    ? {
        attachments: row.attachments as NonNullable<Task["comments"][number]["attachments"]>,
      }
    : {}),
});
/**
 * Returns the first project from a query result, or `null`.
 *
 * @param {Array<ProjectRow>} rows
 */
export const firstProject = (rows: Array<ProjectRow>) => (rows[0] === undefined ? null : toProject(rows[0]));
/**
 * Returns the first section from a query result, or `null`.
 *
 * @param {Array<SectionRow>} rows
 */
export const firstSection = (rows: Array<SectionRow>) => (rows[0] === undefined ? null : toSection(rows[0]));
