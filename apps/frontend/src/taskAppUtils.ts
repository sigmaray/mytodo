import type { Project, ProjectId, Section, SectionId, TaskNode } from "@todoist-clone/domain";
import { renderAdvancedMarkdownDocument, renderTaskMarkdownDocument } from "@todoist-clone/domain";
import type { DragEvent } from "react";

/**
 * Положение курсора относительно задачи при перетаскивании.
 *
 * @typedef {"before" | "inside" | "after" | "outdent"} DragPlacement
 */
export type DragPlacement = "before" | "inside" | "after" | "outdent";

/** Специальный идентификатор списка Входящие для выбора места размещения. */
export const inboxPlacement = "inbox";
/**
 * Кодирует проект в строковый идентификатор места размещения.
 *
 * @param {ProjectId} id
 */
export const projectPlacement = (id: ProjectId) => `project:${id}`;
/**
 * Кодирует секцию в строковый идентификатор места размещения.
 *
 * @param {SectionId} id
 */
export const sectionPlacement = (id: SectionId) => `section:${id}`;

/**
 * Возвращает идентификатор списка, в котором находится задача.
 *
 * @param {TaskNode} task
 */
export const taskPlacement = (task: TaskNode) =>
  task.sectionId !== null
    ? sectionPlacement(task.sectionId)
    : task.projectId !== null
      ? projectPlacement(task.projectId)
      : inboxPlacement;

/**
 * Разбирает идентификатор места и определяет проект/секцию для размещения.
 *
 * @param {string} placement
 * @param {Array<Section>} sections
 * @returns {{ projectId: ProjectId | null; sectionId: SectionId | null }}
 */
export const parsePlacement = (
  placement: string,
  sections: Array<Section>,
): { projectId: ProjectId | null; sectionId: SectionId | null } => {
  /** Для секции проект определяется по её записи, поскольку его нет в строковом ID. */
  if (placement.startsWith("project:")) {
    return { projectId: placement.slice("project:".length), sectionId: null };
  }

  if (placement.startsWith("section:")) {
    const sectionId = placement.slice("section:".length);
    return {
      projectId: sections.find((section) => section.id === sectionId)?.projectId ?? null,
      sectionId,
    };
  }

  return { projectId: null, sectionId: null };
};

/**
 * Формирует отсортированные подписи всех доступных мест создания задачи.
 *
 * @param {Array<Project>} projects
 * @param {Array<Section>} sections
 * @returns {Array<{ value: string; label: string }>}
 */
export const createPlacementOptions = (
  projects: Array<Project>,
  sections: Array<Section>,
): Array<{ value: string; label: string }> =>
  [
    { value: inboxPlacement, label: "Inbox" },
    ...sections.map((section) => {
      const projectTitle =
        section.projectId === null
          ? "Inbox"
          : (projects.find((project) => project.id === section.projectId)?.title ?? "Project");
      return {
        value: sectionPlacement(section.id),
        label: `${projectTitle} / ${section.title}`,
      };
    }),
    ...projects.map((project) => ({ value: projectPlacement(project.id), label: project.title })),
  ].sort(
    (left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" }) ||
      left.value.localeCompare(right.value),
  );

/**
 * Ищет узел дерева по ID, включая любые уровни вложенных задач.
 *
 * @param {Array<TaskNode>} tasks
 * @param {string} id
 * @returns {TaskNode | null}
 */
export const findTaskNode = (tasks: Array<TaskNode>, id: string): TaskNode | null =>
  tasks.reduce<TaskNode | null>(
    (found, task) => found ?? (task.id === id ? task : findTaskNode(task.children, id)),
    null,
  );

/**
 * Оставляет задачи, удовлетворяющие условию, и сохраняет их исходных потомков.
 *
 * @param {Array<TaskNode>} tasks
 * @param {(task: TaskNode) => boolean} predicate
 * @returns {Array<TaskNode>}
 */
export const filterTaskTree = (
  tasks: Array<TaskNode>,
  predicate: (task: TaskNode) => boolean,
): Array<TaskNode> =>
  tasks.flatMap((task) => {
    if (predicate(task)) return [task];
    return filterTaskTree(task.children, predicate);
  });

/**
 * Проверяет, содержит ли поддерево задачи узел с указанным идентификатором.
 *
 * @param {TaskNode} task
 * @param {string} id
 * @returns {boolean}
 */
export const hasDescendant = (task: TaskNode, id: string): boolean =>
  task.children.some((child) => child.id === id || hasDescendant(child, id));

/**
 * Вычисляет место сброса по координатам курсора и отступу строки задачи.
 *
 * @param {DragEvent<HTMLElement>} event
 * @returns {DragPlacement}
 */
export const dragPlacementFromEvent = (event: DragEvent<HTMLElement>): DragPlacement => {
  /** Виртуальные события и строки без layout могут не иметь полезных координат или размеров. */
  const { top, left, height } = event.currentTarget.getBoundingClientRect();
  const pointerX = Number.isFinite(event.clientX) ? event.clientX : left;
  const pointerY = Number.isFinite(event.clientY) ? event.clientY : 0;
  const virtualY = Number.isFinite(height) && height > 0 ? null : pointerY;
  const y = pointerY - (Number.isFinite(top) ? top : 0);
  const indent = Number.parseFloat(event.currentTarget.style.paddingLeft || "0");
  const depth = Number.parseInt(event.currentTarget.dataset.taskDepth ?? "0", 10);

  if ((Number.isFinite(left) && pointerX < left - 18) || (pointerX <= 0 && (indent > 0 || depth > 0))) {
    return "outdent";
  }

  if (virtualY !== null) {
    return virtualY < 35 ? "before" : virtualY > 65 ? "after" : "inside";
  }

  return y < height * 0.35 ? "before" : y > height * 0.65 ? "after" : "inside";
};

/**
 * Формирует простой Markdown для открытого проекта либо списка Входящие.
 *
 * @param {string} title
 * @param {Array<TaskNode>} inboxRootTasks
 * @param {Array<Section>} sections
 * @param {Array<TaskNode>} allTasks
 * @param {ProjectId | null} targetProjectId
 * @returns Результат выполнения функции.
 */
export const currentMarkdown = (
  title: string,
  inboxRootTasks: Array<TaskNode>,
  sections: Array<Section>,
  allTasks: Array<TaskNode>,
  targetProjectId: ProjectId | null,
) => {
  /** В экспорте проекта разделяем корневые задачи и задачи его секций. */
  if (targetProjectId !== null) {
    return renderTaskMarkdownDocument(
      title,
      allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null),
      sections
        .filter((section) => section.projectId === targetProjectId)
        .map((section) => ({
          title: section.title,
          tasks: allTasks.filter(
            (task) => task.projectId === targetProjectId && task.sectionId === section.id,
          ),
        })),
    );
  }

  return renderTaskMarkdownDocument(
    "Inbox",
    inboxRootTasks,
    sections
      .filter((section) => section.projectId === null)
      .map((section) => ({
        title: section.title,
        tasks: allTasks.filter((task) => task.projectId === null && task.sectionId === section.id),
      })),
  );
};

/**
 * Формирует расширенный Markdown для выбранной области с описанием и деталями задач.
 *
 * @param {string} title
 * @param {Array<Section>} sections
 * @param {Array<TaskNode>} allTasks
 * @param {ProjectId | null} targetProjectId
 * @param {string} description
 */
export const currentAdvancedMarkdown = (
  title: string,
  sections: Array<Section>,
  allTasks: Array<TaskNode>,
  targetProjectId: ProjectId | null,
  description: string,
) =>
  /** Функция отображения доменного пакета формирует вложенность и подробности задачи. */
  renderAdvancedMarkdownDocument(
    title,
    allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null),
    sections
      .filter((section) => section.projectId === targetProjectId)
      .map((section) => ({
        title: section.title,
        tasks: allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === section.id),
      })),
    description,
  );

/**
 * Собирает Markdown-документ со всеми списками и проектами пользователя.
 *
 * @param {Array<Project>} projects
 * @param {Array<Section>} sections
 * @param {Array<TaskNode>} tasks
 */
export const allMarkdownDocument = (
  projects: Array<Project>,
  sections: Array<Section>,
  tasks: Array<TaskNode>,
) =>
  renderTaskMarkdownDocument(
    "All tasks",
    [],
    [
      {
        title: "Inbox",
        tasks: tasks.filter((task) => task.projectId === null && task.sectionId === null),
      },
      ...sections
        .filter((section) => section.projectId === null)
        .map((section) => ({
          title: `Inbox / ${section.title}`,
          tasks: tasks.filter((task) => task.projectId === null && task.sectionId === section.id),
        })),
      ...projects.flatMap((project) => [
        {
          title: project.title,
          tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === null),
        },
        ...sections
          .filter((section) => section.projectId === project.id)
          .map((section) => ({
            title: `${project.title} / ${section.title}`,
            tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === section.id),
          })),
      ]),
    ],
  );

/**
 * Собирает расширенный Markdown по всем областям вместе с их описаниями.
 *
 * @param {Array<Project>} projects
 * @param {Array<Section>} sections
 * @param {Array<TaskNode>} tasks
 * @param {string} inboxDescription
 */
export const allAdvancedMarkdownDocument = (
  projects: Array<Project>,
  sections: Array<Section>,
  tasks: Array<TaskNode>,
  inboxDescription: string,
) =>
  renderAdvancedMarkdownDocument(
    "All tasks",
    [],
    [
      {
        title: "Inbox",
        description: inboxDescription,
        tasks: tasks.filter((task) => task.projectId === null && task.sectionId === null),
      },
      ...sections
        .filter((section) => section.projectId === null)
        .map((section) => ({
          title: `Inbox / ${section.title}`,
          tasks: tasks.filter((task) => task.projectId === null && task.sectionId === section.id),
        })),
      ...projects.flatMap((project) => [
        {
          title: project.title,
          description: project.description,
          tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === null),
        },
        ...sections
          .filter((section) => section.projectId === project.id)
          .map((section) => ({
            title: `${project.title} / ${section.title}`,
            tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === section.id),
          })),
      ]),
    ],
  );

/**
 * Копирует текст в буфер обмена и использует временное поле как запасной путь.
 *
 * @param {string} text
 */
export const copyText = async (text: string) => {
  if (navigator.clipboard !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }

  /** Запасной способ нужен браузерам без Clipboard API или без выданного разрешения. */
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

/**
 * Запускает скачивание Blob через временную ссылку и освобождает её URL.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
