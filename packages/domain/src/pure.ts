import type { ProjectId, SectionId, Task, TaskId, TaskNode } from "./types";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const base = alphabet.length;
const firstDigit = alphabet[0] ?? "0";
const middleDigit = alphabet[Math.floor(base / 2)] ?? "V";

const compareTaskOrder = (left: Task, right: Task) =>
  left.lexicalOrder < right.lexicalOrder
    ? -1
    : left.lexicalOrder > right.lexicalOrder
      ? 1
      : left.createdAt.localeCompare(right.createdAt);

const freezeNode = (task: Task, children: ReadonlyArray<TaskNode>): TaskNode =>
  Object.freeze({
    ...task,
    children: Object.freeze(children),
  });

export const buildTaskTree = (tasks: ReadonlyArray<Task>): ReadonlyArray<TaskNode> => {
  const buildChildren = (parentId: TaskId | null): ReadonlyArray<TaskNode> =>
    Object.freeze(
      tasks
        .filter((task) => task.parentId === parentId)
        .toSorted(compareTaskOrder)
        .map((task) => freezeNode(task, buildChildren(task.id))),
    );

  return buildChildren(null);
};

const charToValue = (char: string | undefined, fallback: number) =>
  char === undefined ? fallback : Math.max(0, alphabet.indexOf(char));

const valueToChar = (value: number) => alphabet[value] ?? middleDigit;

export const generateLexicalOrder = (before: string | null, after: string | null): string => {
  const left = before ?? "";
  const right = after ?? "";

  const findMiddle = (index: number, prefix: string): string => {
    const low = charToValue(left[index], -1);
    const high = charToValue(right[index], base);

    if (high - low > 1) {
      return `${prefix}${valueToChar(Math.floor((low + high) / 2))}`;
    }

    return findMiddle(index + 1, `${prefix}${left[index] ?? firstDigit}`);
  };

  return findMiddle(0, "");
};

export type TaskPlacement = Readonly<{
  parentId: TaskId | null;
  projectId: ProjectId | null;
  sectionId: SectionId | null;
  beforeId: TaskId | null;
  afterId: TaskId | null;
}>;

export type DropPosition = "before" | "after";

const sameLocation = (
  task: Task,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
): boolean => task.parentId === parentId && task.projectId === projectId && task.sectionId === sectionId;

export const listSiblings = (
  tasks: ReadonlyArray<Task>,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
): ReadonlyArray<Task> =>
  Object.freeze(
    tasks.filter((task) => sameLocation(task, parentId, projectId, sectionId)).toSorted(compareTaskOrder),
  );

const isDescendantOf = (tasks: ReadonlyArray<Task>, ancestorId: TaskId, id: TaskId): boolean => {
  const task = tasks.find((candidate) => candidate.id === id);

  if (task === undefined || task.parentId === null) {
    return false;
  }

  return task.parentId === ancestorId || isDescendantOf(tasks, ancestorId, task.parentId);
};

export const computeDropPlacement = (
  tasks: ReadonlyArray<Task>,
  moved: Task,
  target: Task,
  position: DropPosition,
): TaskPlacement | null => {
  if (moved.id === target.id || isDescendantOf(tasks, moved.id, target.id)) {
    return null;
  }

  const placement = Object.freeze({
    parentId: target.parentId,
    projectId: target.projectId,
    sectionId: target.sectionId,
    beforeId: position === "before" ? target.id : null,
    afterId: position === "after" ? target.id : null,
  });

  if (!sameLocation(moved, placement.parentId, placement.projectId, placement.sectionId)) {
    return placement;
  }

  const siblings = listSiblings(tasks, placement.parentId, placement.projectId, placement.sectionId);
  const movedIndex = siblings.findIndex((task) => task.id === moved.id);
  const targetIndex = siblings.findIndex((task) => task.id === target.id);

  if (position === "before" && movedIndex === targetIndex - 1) {
    return null;
  }

  if (position === "after" && movedIndex === targetIndex + 1) {
    return null;
  }

  return placement;
};

export const computeIndentPlacement = (tasks: ReadonlyArray<Task>, task: Task): TaskPlacement | null => {
  const siblings = listSiblings(tasks, task.parentId, task.projectId, task.sectionId);
  const index = siblings.findIndex((sibling) => sibling.id === task.id);
  const previous = index > 0 ? siblings[index - 1] : undefined;

  if (previous === undefined) {
    return null;
  }

  return Object.freeze({
    parentId: previous.id,
    projectId: previous.projectId,
    sectionId: previous.sectionId,
    beforeId: null,
    afterId: null,
  });
};

export const computeOutdentPlacement = (tasks: ReadonlyArray<Task>, task: Task): TaskPlacement | null => {
  if (task.parentId === null) {
    return null;
  }

  const parent = tasks.find((candidate) => candidate.id === task.parentId);

  if (parent === undefined) {
    return null;
  }

  return Object.freeze({
    parentId: parent.parentId,
    projectId: parent.projectId,
    sectionId: parent.sectionId,
    beforeId: null,
    afterId: parent.id,
  });
};

const checkbox = (completed: boolean) => (completed ? "x" : " ");

const renderTaskMarkdown = (task: TaskNode, depth: number): ReadonlyArray<string> =>
  Object.freeze([
    `${"  ".repeat(depth)}- [${checkbox(task.completed)}] ${task.title}`,
    ...task.children.flatMap((child) => renderTaskMarkdown(child, depth + 1)),
  ]);

export const renderTaskMarkdownDocument = (
  title: string,
  tasks: ReadonlyArray<TaskNode>,
  sections: ReadonlyArray<Readonly<{ title: string; tasks: ReadonlyArray<TaskNode> }>> = Object.freeze([]),
): string => {
  const body = tasks.flatMap((task) => renderTaskMarkdown(task, 0));
  const sectionContent = sections.flatMap((section, index) => [
    ...(body.length > 0 || index > 0 ? [""] : []),
    `## ${section.title}`,
    "",
    ...(section.tasks.length > 0
      ? section.tasks.flatMap((task) => renderTaskMarkdown(task, 0))
      : ["_No tasks._"]),
  ]);
  return [
    `# ${title}`,
    "",
    ...(body.length > 0 ? body : sections.length === 0 ? ["_No tasks._"] : []),
    ...sectionContent,
    "",
  ].join("\n");
};

const quoteMarkdownText = (value: string, prefix: string): ReadonlyArray<string> =>
  Object.freeze(value.split("\n").map((line) => `${prefix}> ${line}`));

const renderAdvancedTaskMarkdown = (task: TaskNode, depth: number): ReadonlyArray<string> => {
  const indent = "  ".repeat(depth);
  const detailPrefix = `${indent}  `;
  const details = [
    ...(task.description.length > 0
      ? quoteMarkdownText(`**Description:** ${task.description}`, detailPrefix)
      : []),
    ...(task.dueDate === null ? [] : [`${detailPrefix}> **Due date:** ${task.dueDate}`]),
    ...(task.labels.length === 0
      ? []
      : [`${detailPrefix}> **Labels:** ${task.labels.map((label) => `\`${label}\``).join(", ")}`]),
    ...(task.comments.length === 0
      ? []
      : [
          `${detailPrefix}> **Comments:**`,
          ...task.comments.flatMap((comment) =>
            quoteMarkdownText(`- ${comment.createdAt} — ${comment.body}`, detailPrefix),
          ),
        ]),
    ...task.children.flatMap((child) => renderAdvancedTaskMarkdown(child, depth + 1)),
  ];
  return Object.freeze([`${indent}- [${checkbox(task.completed)}] ${task.title}`, ...details]);
};

export const renderAdvancedMarkdownDocument = (
  title: string,
  tasks: ReadonlyArray<TaskNode>,
  sections: ReadonlyArray<
    Readonly<{ title: string; tasks: ReadonlyArray<TaskNode>; description?: string }>
  > = Object.freeze([]),
  description = "",
): string => {
  const body = [
    ...(description.length > 0 ? quoteMarkdownText(`**Description:** ${description}`, "") : []),
    ...tasks.flatMap((task) => renderAdvancedTaskMarkdown(task, 0)),
  ];
  const sectionContent = sections.flatMap((section, index) => [
    ...(body.length > 0 || index > 0 ? [""] : []),
    `## ${section.title}`,
    "",
    ...(section.description ? quoteMarkdownText(`**Description:** ${section.description}`, "") : []),
    ...(section.tasks.length > 0
      ? section.tasks.flatMap((task) => renderAdvancedTaskMarkdown(task, 0))
      : ["_No tasks._"]),
  ]);
  return [
    `# ${title}`,
    "",
    ...(body.length > 0 ? body : sections.length === 0 ? ["_No tasks._"] : []),
    ...sectionContent,
    "",
  ].join("\n");
};
