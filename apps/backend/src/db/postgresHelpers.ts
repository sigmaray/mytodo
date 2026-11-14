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

/** Тип строки задачи, возвращаемой Drizzle из PostgreSQL. */
type TaskRow = typeof tasksTable.$inferSelect;
/** Тип строки комментария из таблицы обсуждений. */
type TaskCommentRow = typeof taskCommentsTable.$inferSelect;
/** Тип строки проекта из таблицы проектов. */
type ProjectRow = typeof projectsTable.$inferSelect;
/** Тип строки секции из таблицы секций. */
type SectionRow = typeof sectionsTable.$inferSelect;

/** Приводит дату из драйвера к единому ISO-формату доменной модели. */
export const normalizeDate = (value: Date | string): string =>
  typeof value === "string" ? new Date(value).toISOString() : value.toISOString();

/** Преобразует строку PostgreSQL в публичную модель задачи. */
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

/** Преобразует строку PostgreSQL в доменную модель проекта. */
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

/** Преобразует строку PostgreSQL в доменную модель секции. */
export const toSection = (row: SectionRow): Section => ({
  id: row.id,
  title: row.title,
  projectId: row.projectId,
  lexicalOrder: row.lexicalOrder,
  createdAt: normalizeDate(row.createdAt),
  updatedAt: normalizeDate(row.updatedAt),
});

/** SQL-сортировка задач по ASCII-порядку ключа lexicalOrder. */
export const rowOrder = asc(sql`${tasksTable.lexicalOrder} COLLATE "C"`);
/** SQL-сортировка проектов по тому же порядку, что использует доменная логика. */
export const projectOrder = asc(sql`${projectsTable.lexicalOrder} COLLATE "C"`);
/** SQL-сортировка секций по лексикографическому ключу. */
export const sectionOrder = asc(sql`${sectionsTable.lexicalOrder} COLLATE "C"`);

/** Строит условие равенства, поддерживающее как строковое значение, так и SQL NULL. */
export const nullableEq = <TColumn>(column: TColumn, value: string | null) =>
  value === null ? isNull(column as never) : eq(column as never, value);

/** Проверяет, что секция принадлежит тому же проекту и пользователю, что задача. */
export const hasValidTaskPlacement = async (
  db: ReturnType<typeof drizzle>,
  userId: string,
  projectId: string | null,
  sectionId: string | null,
): Promise<boolean> => {
  // Отсутствие секции допустимо для корня проекта или Входящих.
  if (sectionId === null) return true;
  const [section] = await db
    .select({ projectId: sectionsTable.projectId })
    .from(sectionsTable)
    .where(and(eq(sectionsTable.id, sectionId), eq(sectionsTable.userId, userId)))
    .limit(1);
  return section !== undefined && section.projectId === projectId;
};

/** Вычисляет лексикографический ключ задачи между указанными соседями. */
export const findSiblingOrder = async (
  db: ReturnType<typeof drizzle>,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
  beforeId: TaskId | null,
  afterId: TaskId | null,
  userId: string,
) => {
  // Берём только соседей того же пользователя, уровня вложенности и проектного списка.
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
  // Ненайденный сосед не задаёт границу; при пустых аргументах новый элемент идёт в конец.
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

/** Рекурсивно собирает идентификаторы задачи и всех её потомков для каскадных операций. */
export const collectDescendantIds = async (
  db: ReturnType<typeof drizzle>,
  id: TaskId,
  userId: string,
): Promise<Array<TaskId>> => {
  // Ищем только задачи того же пользователя, чтобы не пересечь границу владения данными.
  const children = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.parentId, id), eq(tasksTable.userId, userId)));
  const descendantIds = await Promise.all(
    children.map((child) => collectDescendantIds(db, child.id, userId)),
  );

  return [id, ...descendantIds.flat()];
};

/** Преобразует первую строку результата в задачу или возвращает `null` при пустом результате. */
export const firstTask = (rows: Array<TaskRow>) => (rows[0] === undefined ? null : toTask(rows[0]));
/** Преобразует строку базы в доменную модель комментария. */
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
/** Возвращает первый проект результата запроса или `null`. */
export const firstProject = (rows: Array<ProjectRow>) => (rows[0] === undefined ? null : toProject(rows[0]));
/** Возвращает первую секцию результата запроса или `null`. */
export const firstSection = (rows: Array<SectionRow>) => (rows[0] === undefined ? null : toSection(rows[0]));
