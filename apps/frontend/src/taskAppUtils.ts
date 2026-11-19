import type { Project, ProjectId, Section, SectionId, TaskNode } from "@todoist-clone/domain";
import { renderAdvancedMarkdownDocument, renderTaskMarkdownDocument } from "@todoist-clone/domain";
import type { DragEvent } from "react";

/**
 * Cursor position relative to a task during a drag.
 *
 * @typedef {"before" | "inside" | "after" | "outdent"} DragPlacement
 */
export type DragPlacement = "before" | "inside" | "after" | "outdent";

/** Special Inbox identifier used when selecting a task placement. */
export const inboxPlacement = "inbox";
/**
 * Encodes a project as a string placement identifier.
 *
 * @param {ProjectId} id
 */
export const projectPlacement = (id: ProjectId) => `project:${id}`;
/**
 * Encodes a section as a string placement identifier.
 *
 * @param {SectionId} id
 */
export const sectionPlacement = (id: SectionId) => `section:${id}`;

/**
 * Returns the list identifier for the list containing a task.
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
 * Parses a placement identifier to determine the destination project or section.
 *
 * @param {string} placement
 * @param {Array<Section>} sections
 * @returns {{ projectId: ProjectId | null; sectionId: SectionId | null }}
 */
export const parsePlacement = (
  placement: string,
  sections: Array<Section>,
): { projectId: ProjectId | null; sectionId: SectionId | null } => {
  /** Resolve the project from the section record because it is not encoded in the string ID. */
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
 * Builds sorted labels for all available task creation placements.
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
 * Finds a tree node by ID, including tasks at any nesting depth.
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
 * Keeps tasks that match a predicate together with their original descendants.
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
 * Checks whether a task subtree contains a node with the specified ID.
 *
 * @param {TaskNode} task
 * @param {string} id
 * @returns {boolean}
 */
export const hasDescendant = (task: TaskNode, id: string): boolean =>
  task.children.some((child) => child.id === id || hasDescendant(child, id));

/**
 * Computes a drop placement from the cursor coordinates and task row indentation.
 *
 * @param {DragEvent<HTMLElement>} event
 * @returns {DragPlacement}
 */
export const dragPlacementFromEvent = (event: DragEvent<HTMLElement>): DragPlacement => {
  /** Synthetic events and rows without layout may not have usable coordinates or dimensions. */
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
 * Builds simple Markdown for the open project or the Inbox.
 *
 * @param {string} title
 * @param {Array<TaskNode>} inboxRootTasks
 * @param {Array<Section>} sections
 * @param {Array<TaskNode>} allTasks
 * @param {ProjectId | null} targetProjectId
 * @returns The Markdown export.
 */
export const currentMarkdown = (
  title: string,
  inboxRootTasks: Array<TaskNode>,
  sections: Array<Section>,
  allTasks: Array<TaskNode>,
  targetProjectId: ProjectId | null,
) => {
  /** Separate root tasks from section tasks when exporting a project. */
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
 * Builds extended Markdown for the selected scope, including its description and task details.
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
  /** The domain package formatter builds task nesting and details. */
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
 * Builds a Markdown document containing all user lists and projects.
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
 * Builds extended Markdown for all scopes, including their descriptions.
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
 * Copies text to the clipboard, using a temporary field as a fallback.
 *
 * @param {string} text
 */
export const copyText = async (text: string) => {
  if (navigator.clipboard !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }

  /** The fallback supports browsers without Clipboard API or clipboard permission. */
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
 * Downloads a Blob through a temporary link and revokes its URL afterward.
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
