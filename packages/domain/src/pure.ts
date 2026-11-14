import type { ProjectId, SectionId, Task, TaskId, TaskNode } from "./types";

/** Алфавит задаёт порядок символов ключа так, чтобы обычное сравнение строк */
/** совпадало с порядком элементов в списке. */
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Основание системы счисления, используемой для дробных ключей сортировки. */
const base = alphabet.length;
/** Минимальная цифра для построения ключа перед самым первым соседом. */
const firstDigit = alphabet[0] ?? "0";
/** Центральная цифра, используемая как запасное значение при преобразовании. */
const middleDigit = alphabet[Math.floor(base / 2)] ?? "V";

/**
 * Сравнивает задачи по ключу сортировки, а при равенстве — по времени создания.
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
 * Собирает узел дерева из исходных полей задачи и готовых дочерних узлов.
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
 * Строит вложенное дерево задач и сортирует каждого родителя с его детьми.
 *
 * @param {Array<Task>} tasks
 * @returns {Array<TaskNode>}
 */
export const buildTaskTree = (tasks: Array<Task>): Array<TaskNode> => {
  /**
   * Рекурсивно находим задачи с указанным родителем и превращаем их в узлы.
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
 * Преобразует символ ключа сортировки в числовую позицию алфавита.
 *
 * @param {string | undefined} char
 * @param {number} fallback
 */
const charToValue = (char: string | undefined, fallback: number) =>
  char === undefined ? fallback : Math.max(0, alphabet.indexOf(char));

/**
 * Преобразует позицию алфавита обратно в символ ключа сортировки.
 *
 * @param {number} value
 */
const valueToChar = (value: number) => alphabet[value] ?? middleDigit;

/**
 * Возвращает новый ключ, который лексикографически расположен между соседями.
 *
 * @param {string | null} before
 * @param {string | null} after
 * @returns {string}
 */
export const generateLexicalOrder = (before: string | null, after: string | null): string => {
  /** Пустые границы позволяют тем же алгоритмом добавлять элементы в начало или конец. */
  const left = before ?? "";
  const right = after ?? "";

  /**
   * Ищем первую позицию, в которой между цифрами границ есть свободное значение.
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
 * Параметры размещения задачи, вычисленные при перетаскивании или изменении вложенности.
 *
 * @typedef {Object} TaskPlacement
 * @property {TaskId | null} parentId - Данные «родитель id», используемые типом «TaskPlacement».
 * @property {ProjectId | null} projectId - Данные «проект id», используемые типом «TaskPlacement».
 * @property {SectionId | null} sectionId - Данные «секция id», используемые типом «TaskPlacement».
 * @property {TaskId | null} beforeId - Данные «предыдущего id», используемые типом «TaskPlacement».
 * @property {TaskId | null} afterId - Данные «следующего id», используемые типом «TaskPlacement».
 */
export type TaskPlacement = {
  parentId: TaskId | null;

  projectId: ProjectId | null;

  sectionId: SectionId | null;

  beforeId: TaskId | null;

  afterId: TaskId | null;
};

/**
 * Сторона целевой задачи, на которую пользователь сбрасывает перетаскиваемую задачу.
 *
 * @typedef {"before" | "after"} DropPosition
 */
export type DropPosition = "before" | "after";

/**
 * Проверяет, совпадают ли родитель, проект и секция у задачи и целевого места.
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
 * Возвращает задачи одного родителя и одного места, упорядоченные для отображения.
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
 * Проверяет по цепочке родителей, является ли задача потомком указанной задачи.
 *
 * @param {Array<Task>} tasks
 * @param {TaskId} ancestorId
 * @param {TaskId} id
 * @returns {boolean}
 */
const isDescendantOf = (tasks: Array<Task>, ancestorId: TaskId, id: TaskId): boolean => {
  /** Отсутствующая задача и корневая задача не могут быть потомками предка. */
  const task = tasks.find((candidate) => candidate.id === id);

  if (task === undefined || task.parentId === null) {
    return false;
  }

  return task.parentId === ancestorId || isDescendantOf(tasks, ancestorId, task.parentId);
};

/**
 * Вычисляет новое место задачи при сбросе перед или после другой задачи.
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
  /** Запрещаем сброс на саму задачу и внутрь её поддерева, чтобы не создать цикл. */
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

  /** При перемещении в том же списке соседние позиции уже соответствуют нужному порядку. */
  if (position === "before" && movedIndex === targetIndex - 1) {
    return null;
  }

  if (position === "after" && movedIndex === targetIndex + 1) {
    return null;
  }

  return placement;
};

/**
 * Вычисляет размещение для отступа: задача становится ребёнком предыдущего соседа.
 *
 * @param {Array<Task>} tasks
 * @param {Task} task
 * @returns {TaskPlacement | null}
 */
export const computeIndentPlacement = (tasks: Array<Task>, task: Task): TaskPlacement | null => {
  const siblings = listSiblings(tasks, task.parentId, task.projectId, task.sectionId);
  const index = siblings.findIndex((sibling) => sibling.id === task.id);
  const previous = index > 0 ? siblings[index - 1] : undefined;

  /** Без предыдущего соседа не существует задачи, под которую можно сделать отступ. */
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
 * Вычисляет размещение для снятия отступа: задача становится рядом со своим родителем.
 *
 * @param {Array<Task>} tasks
 * @param {Task} task
 * @returns {TaskPlacement | null}
 */
export const computeOutdentPlacement = (tasks: Array<Task>, task: Task): TaskPlacement | null => {
  /** Корневую задачу нельзя поднять выше: у неё уже нет родителя. */
  if (task.parentId === null) {
    return null;
  }

  const parent = tasks.find((candidate) => candidate.id === task.parentId);

  /** Родитель мог быть удалён или отсутствовать в переданном наборе задач. */
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
 * Возвращает символ чекбокса Markdown для текущего состояния задачи.
 *
 * @param {boolean} completed
 */
const checkbox = (completed: boolean) => (completed ? "x" : " ");

/**
 * Формирует Markdown-строки для задачи и всех её потомков с отступами по глубине.
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
 * Экспортирует заголовок, корневые задачи и секции в простой Markdown-чеклист.
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
  /** Сначала готовим корневые задачи, затем добавляем заголовки и содержимое секций. */
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
 * Превращает каждую строку текста в цитату Markdown с указанным отступом.
 *
 * @param {string} value
 * @param {string} prefix
 * @returns {Array<string>}
 */
const quoteMarkdownText = (value: string, prefix: string): Array<string> =>
  value.split("\n").map((line) => `${prefix}> ${line}`);

/**
 * Формирует Markdown для задачи с описанием, сроком, метками, комментариями и детьми.
 *
 * @param {TaskNode} task
 * @param {number} depth
 * @returns {Array<string>}
 */
const renderAdvancedTaskMarkdown = (task: TaskNode, depth: number): Array<string> => {
  /** Детали выводятся как вложенная цитата, чтобы визуально относились к своей задаче. */
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
 * Экспортирует расширенный Markdown с описаниями областей и полными деталями задач.
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
  /** Общие заметки и задачи верхнего уровня образуют основное тело документа. */
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
