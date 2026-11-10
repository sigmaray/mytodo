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

type TaskRow = typeof tasksTable.$inferSelect;
type TaskCommentRow = typeof taskCommentsTable.$inferSelect;
type ProjectRow = typeof projectsTable.$inferSelect;
type SectionRow = typeof sectionsTable.$inferSelect;

export const normalizeDate = (value: Date | string): string =>
  typeof value === "string" ? new Date(value).toISOString() : value.toISOString();

export const toTask = (
  row: TaskRow,
  comments: ReadonlyArray<Task["comments"][number]> = Object.freeze([]),
): Task =>
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

export const toProject = (row: ProjectRow): Project =>
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

export const toSection = (row: SectionRow): Section =>
  Object.freeze({
    id: row.id,
    title: row.title,
    projectId: row.projectId,
    lexicalOrder: row.lexicalOrder,
    createdAt: normalizeDate(row.createdAt),
    updatedAt: normalizeDate(row.updatedAt),
  });

export const rowOrder = asc(sql`${tasksTable.lexicalOrder} COLLATE "C"`);
export const projectOrder = asc(sql`${projectsTable.lexicalOrder} COLLATE "C"`);
export const sectionOrder = asc(sql`${sectionsTable.lexicalOrder} COLLATE "C"`);

export const nullableEq = <TColumn>(column: TColumn, value: string | null) =>
  value === null ? isNull(column as never) : eq(column as never, value);

export const hasValidTaskPlacement = async (
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

export const findSiblingOrder = async (
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

export const collectDescendantIds = async (
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

export const firstTask = (rows: ReadonlyArray<TaskRow>) => (rows[0] === undefined ? null : toTask(rows[0]));
export const toComment = (row: TaskCommentRow): Task["comments"][number] =>
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
export const firstProject = (rows: ReadonlyArray<ProjectRow>) =>
  rows[0] === undefined ? null : toProject(rows[0]);
export const firstSection = (rows: ReadonlyArray<SectionRow>) =>
  rows[0] === undefined ? null : toSection(rows[0]);
