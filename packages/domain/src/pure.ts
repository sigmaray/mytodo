import type { ProjectId, SectionId, Task, TaskId, TaskNode } from "./types";

/** The alphabet orders key characters so that normal string comparison */
/** matches the order of items in the list. */
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Radix used to represent fractional sort keys. */
const base = alphabet.length;
/** Smallest digit used to build a key before the first neighbor. */
const firstDigit = alphabet[0] ?? "0";
/** Middle digit used as a fallback during conversion. */
const middleDigit = alphabet[Math.floor(base / 2)] ?? "V";

/**
 * Compares tasks by sort key, then by creation time when the keys are equal.
 *
 * @param {Task} left
 * @param {Task} right
 */
const compareTaskOrder = (left: Task, right: Task) =>
  left.lexicalOrder < right.lexicalOrder
    ? -1
    : left.lexicalOrder > right.lexicalOrder
      ? 1
      : left.createdAt.localeCompare(right.createdAt);

/**
 * Builds a tree node from a task’s fields and its prepared child nodes.
 *
 * @param {Task} task
 * @param {Array<TaskNode>} children
 * @returns {TaskNode}
 */
const freezeNode = (task: Task, children: Array<TaskNode>): TaskNode => ({
  ...task,
  children: children,
});

/**
 * Builds a nested task tree and sorts each parent with its children.
 *
 * @param {Array<Task>} tasks
 * @returns {Array<TaskNode>}
 */
export const buildTaskTree = (tasks: Array<Task>): Array<TaskNode> => {
  /**
   * Recursively find tasks with the specified parent and convert them to nodes.
   *
   * @param {TaskId | null} parentId
   * @returns {Array<TaskNode>}
   */
  const buildChildren = (parentId: TaskId | null): Array<TaskNode> =>
    tasks
      .filter((task) => task.parentId === parentId)
      .toSorted(compareTaskOrder)
      .map((task) => freezeNode(task, buildChildren(task.id)));

  return buildChildren(null);
};

/**
 * Converts a sort key character to its numeric position in the alphabet.
 *
 * @param {string | undefined} char
 * @param {number} fallback
 */
const charToValue = (char: string | undefined, fallback: number) =>
  char === undefined ? fallback : Math.max(0, alphabet.indexOf(char));

/**
 * Converts an alphabet position back to a sort key character.
 *
 * @param {number} value
 */
const valueToChar = (value: number) => alphabet[value] ?? middleDigit;

/**
 * Returns a new key that sorts lexicographically between its neighbors.
 *
 * @param {string | null} before
 * @param {string | null} after
 * @returns {string}
 */
export const generateLexicalOrder = (before: string | null, after: string | null): string => {
  /** Empty bounds let the same algorithm insert items at either end. */
  const left = before ?? "";
  const right = after ?? "";

  /**
   * Find the first position where the boundary digits leave room for another value.
   *
   * @param {number} index
   * @param {string} prefix
   * @returns {string}
   */
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

/**
 * Task placement computed during a drag or indentation change.
 *
 * @typedef {Object} TaskPlacement
 * @property {TaskId | null} parentId - Parent task ID, or `null` for a root task.
 * @property {ProjectId | null} projectId - Project ID, or `null` for the Inbox.
 * @property {SectionId | null} sectionId - Section ID, or `null` for the project root.
 * @property {TaskId | null} beforeId - ID of the task before this placement, if any.
 * @property {TaskId | null} afterId - ID of the task after this placement, if any.
 */
export type TaskPlacement = {
  parentId: TaskId | null;

  projectId: ProjectId | null;

  sectionId: SectionId | null;

  beforeId: TaskId | null;

  afterId: TaskId | null;
};

/**
 * Side of the target task where the dragged task is dropped.
 *
 * @typedef {"before" | "after"} DropPosition
 */
export type DropPosition = "before" | "after";

/**
 * Checks whether a task and its target placement have the same parent, project, and section.
 *
 * @param {Task} task
 * @param {TaskId | null} parentId
 * @param {ProjectId | null} projectId
 * @param {SectionId | null} sectionId
 * @returns {boolean}
 */
const sameLocation = (
  task: Task,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
): boolean => task.parentId === parentId && task.projectId === projectId && task.sectionId === sectionId;

/**
 * Returns tasks with the same parent and placement, sorted for display.
 *
 * @param {Array<Task>} tasks
 * @param {TaskId | null} parentId
 * @param {ProjectId | null} projectId
 * @param {SectionId | null} sectionId
 * @returns {Array<Task>}
 */
export const listSiblings = (
  tasks: Array<Task>,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
): Array<Task> =>
  tasks.filter((task) => sameLocation(task, parentId, projectId, sectionId)).toSorted(compareTaskOrder);

/**
 * Checks the parent chain to determine whether a task is a descendant of another task.
 *
 * @param {Array<Task>} tasks
 * @param {TaskId} ancestorId
 * @param {TaskId} id
 * @returns {boolean}
 */
const isDescendantOf = (tasks: Array<Task>, ancestorId: TaskId, id: TaskId): boolean => {
  /** A missing task or a root task cannot be a descendant of another task. */
  const task = tasks.find((candidate) => candidate.id === id);

  if (task === undefined || task.parentId === null) {
    return false;
  }

  return task.parentId === ancestorId || isDescendantOf(tasks, ancestorId, task.parentId);
};

/**
 * Computes a task’s new placement when it is dropped before or after another task.
 *
 * @param {Array<Task>} tasks
 * @param {Task} moved
 * @param {Task} target
 * @param {DropPosition} position
 * @returns {TaskPlacement | null}
 */
export const computeDropPlacement = (
  tasks: Array<Task>,
  moved: Task,
  target: Task,
  position: DropPosition,
): TaskPlacement | null => {
  /** Prevent drops onto the task itself or inside its subtree to avoid creating a cycle. */
  if (moved.id === target.id || isDescendantOf(tasks, moved.id, target.id)) {
    return null;
  }

  const placement = {
    parentId: target.parentId,
    projectId: target.projectId,
    sectionId: target.sectionId,
    beforeId: position === "before" ? target.id : null,
    afterId: position === "after" ? target.id : null,
  };

  if (!sameLocation(moved, placement.parentId, placement.projectId, placement.sectionId)) {
    return placement;
  }

  const siblings = listSiblings(tasks, placement.parentId, placement.projectId, placement.sectionId);
  const movedIndex = siblings.findIndex((task) => task.id === moved.id);
  const targetIndex = siblings.findIndex((task) => task.id === target.id);

  /** When moving within the same list, the neighboring positions already reflect the desired order. */
  if (position === "before" && movedIndex === targetIndex - 1) {
    return null;
  }

  if (position === "after" && movedIndex === targetIndex + 1) {
    return null;
  }

  return placement;
};

/**
 * Computes the placement for indenting a task under its previous sibling.
 *
 * @param {Array<Task>} tasks
 * @param {Task} task
 * @returns {TaskPlacement | null}
 */
export const computeIndentPlacement = (tasks: Array<Task>, task: Task): TaskPlacement | null => {
  const siblings = listSiblings(tasks, task.parentId, task.projectId, task.sectionId);
  const index = siblings.findIndex((sibling) => sibling.id === task.id);
  const previous = index > 0 ? siblings[index - 1] : undefined;

  /** Without a previous sibling, there is no task to indent under. */
  if (previous === undefined) {
    return null;
  }

  return {
    parentId: previous.id,
    projectId: previous.projectId,
    sectionId: previous.sectionId,
    beforeId: null,
    afterId: null,
  };
};

/**
 * Computes the placement for outdenting a task to become a sibling of its parent.
 *
 * @param {Array<Task>} tasks
 * @param {Task} task
 * @returns {TaskPlacement | null}
 */
export const computeOutdentPlacement = (tasks: Array<Task>, task: Task): TaskPlacement | null => {
  /** A root task cannot be outdented because it has no parent. */
  if (task.parentId === null) {
    return null;
  }

  const parent = tasks.find((candidate) => candidate.id === task.parentId);

  /** The parent may have been deleted or omitted from the supplied task set. */
  if (parent === undefined) {
    return null;
  }

  return {
    parentId: parent.parentId,
    projectId: parent.projectId,
    sectionId: parent.sectionId,
    beforeId: null,
    afterId: parent.id,
  };
};

/**
 * Returns a Markdown checkbox marker for the task’s current status.
 *
 * @param {boolean} completed
 */
const checkbox = (completed: boolean) => (completed ? "x" : " ");

/**
 * Builds Markdown lines for a task and all descendants, indented by depth.
 *
 * @param {TaskNode} task
 * @param {number} depth
 * @returns {Array<string>}
 */
const renderTaskMarkdown = (task: TaskNode, depth: number): Array<string> => [
  `${"  ".repeat(depth)}- [${checkbox(task.completed)}] ${task.title}`,
  ...task.children.flatMap((child) => renderTaskMarkdown(child, depth + 1)),
];

/**
 * Exports the title, root tasks, and sections as a simple Markdown checklist.
 *
 * @param {string} title
 * @param {Array<TaskNode>} tasks
 * @param {Array<{ title: string; tasks: Array<TaskNode> }>} [sections]
 * @returns {string}
 */
export const renderTaskMarkdownDocument = (
  title: string,
  tasks: Array<TaskNode>,
  sections: Array<{ title: string; tasks: Array<TaskNode> }> = [],
): string => {
  /** Build root tasks first, then append section headings and their contents. */
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

/**
 * Converts each text line to a Markdown quote with the specified indentation.
 *
 * @param {string} value
 * @param {string} prefix
 * @returns {Array<string>}
 */
const quoteMarkdownText = (value: string, prefix: string): Array<string> =>
  value.split("\n").map((line) => `${prefix}> ${line}`);

/**
 * Builds Markdown for a task with its description, due date, labels, comments, and children.
 *
 * @param {TaskNode} task
 * @param {number} depth
 * @returns {Array<string>}
 */
const renderAdvancedTaskMarkdown = (task: TaskNode, depth: number): Array<string> => {
  /** Render details as a nested quote so they remain visually associated with the task. */
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
  return [`${indent}- [${checkbox(task.completed)}] ${task.title}`, ...details];
};

/**
 * Exports extended Markdown with area descriptions and full task details.
 *
 * @param {string} title
 * @param {Array<TaskNode>} tasks
 * @param {Array<{ title: string; tasks: Array<TaskNode>; description?: string }>} [sections]
 * @param [description]
 * @returns {string}
 */
export const renderAdvancedMarkdownDocument = (
  title: string,
  tasks: Array<TaskNode>,
  sections: Array<{ title: string; tasks: Array<TaskNode>; description?: string }> = [],
  description = "",
): string => {
  /** General notes and top-level tasks form the main body of the document. */
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
