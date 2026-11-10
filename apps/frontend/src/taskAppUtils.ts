import type { Project, ProjectId, Section, SectionId, TaskNode } from "@todoist-clone/domain";
import { renderAdvancedMarkdownDocument, renderTaskMarkdownDocument } from "@todoist-clone/domain";
import type { DragEvent } from "react";

export type DragPlacement = "before" | "inside" | "after" | "outdent";

export const inboxPlacement = "inbox";
export const projectPlacement = (id: ProjectId) => `project:${id}`;
export const sectionPlacement = (id: SectionId) => `section:${id}`;

export const taskPlacement = (task: TaskNode) =>
  task.sectionId !== null
    ? sectionPlacement(task.sectionId)
    : task.projectId !== null
      ? projectPlacement(task.projectId)
      : inboxPlacement;

export const parsePlacement = (
  placement: string,
  sections: ReadonlyArray<Section>,
): Readonly<{ projectId: ProjectId | null; sectionId: SectionId | null }> => {
  if (placement.startsWith("project:")) {
    return Object.freeze({ projectId: placement.slice("project:".length), sectionId: null });
  }

  if (placement.startsWith("section:")) {
    const sectionId = placement.slice("section:".length);
    return Object.freeze({
      projectId: sections.find((section) => section.id === sectionId)?.projectId ?? null,
      sectionId,
    });
  }

  return Object.freeze({ projectId: null, sectionId: null });
};

export const createPlacementOptions = (
  projects: ReadonlyArray<Project>,
  sections: ReadonlyArray<Section>,
): ReadonlyArray<Readonly<{ value: string; label: string }>> =>
  Object.freeze(
    [
      Object.freeze({ value: inboxPlacement, label: "Inbox" }),
      ...sections.map((section) => {
        const projectTitle =
          section.projectId === null
            ? "Inbox"
            : (projects.find((project) => project.id === section.projectId)?.title ?? "Project");
        return Object.freeze({
          value: sectionPlacement(section.id),
          label: `${projectTitle} / ${section.title}`,
        });
      }),
      ...projects.map((project) =>
        Object.freeze({ value: projectPlacement(project.id), label: project.title }),
      ),
    ].sort(
      (left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: "base" }) ||
        left.value.localeCompare(right.value),
    ),
  );

export const findTaskNode = (tasks: ReadonlyArray<TaskNode>, id: string): TaskNode | null =>
  tasks.reduce<TaskNode | null>(
    (found, task) => found ?? (task.id === id ? task : findTaskNode(task.children, id)),
    null,
  );

export const filterTaskTree = (
  tasks: ReadonlyArray<TaskNode>,
  predicate: (task: TaskNode) => boolean,
): ReadonlyArray<TaskNode> =>
  Object.freeze(
    tasks.flatMap((task) => {
      if (predicate(task)) return [task];
      return filterTaskTree(task.children, predicate);
    }),
  );

export const hasDescendant = (task: TaskNode, id: string): boolean =>
  task.children.some((child) => child.id === id || hasDescendant(child, id));

export const dragPlacementFromEvent = (event: DragEvent<HTMLElement>): DragPlacement => {
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

export const currentMarkdown = (
  title: string,
  inboxRootTasks: ReadonlyArray<TaskNode>,
  sections: ReadonlyArray<Section>,
  allTasks: ReadonlyArray<TaskNode>,
  targetProjectId: ProjectId | null,
) => {
  if (targetProjectId !== null) {
    return renderTaskMarkdownDocument(
      title,
      allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null),
      sections
        .filter((section) => section.projectId === targetProjectId)
        .map((section) =>
          Object.freeze({
            title: section.title,
            tasks: allTasks.filter(
              (task) => task.projectId === targetProjectId && task.sectionId === section.id,
            ),
          }),
        ),
    );
  }

  return renderTaskMarkdownDocument(
    "Inbox",
    inboxRootTasks,
    sections
      .filter((section) => section.projectId === null)
      .map((section) =>
        Object.freeze({
          title: section.title,
          tasks: allTasks.filter((task) => task.projectId === null && task.sectionId === section.id),
        }),
      ),
  );
};

export const currentAdvancedMarkdown = (
  title: string,
  sections: ReadonlyArray<Section>,
  allTasks: ReadonlyArray<TaskNode>,
  targetProjectId: ProjectId | null,
  description: string,
) =>
  renderAdvancedMarkdownDocument(
    title,
    allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null),
    sections
      .filter((section) => section.projectId === targetProjectId)
      .map((section) =>
        Object.freeze({
          title: section.title,
          tasks: allTasks.filter(
            (task) => task.projectId === targetProjectId && task.sectionId === section.id,
          ),
        }),
      ),
    description,
  );

export const allMarkdownDocument = (
  projects: ReadonlyArray<Project>,
  sections: ReadonlyArray<Section>,
  tasks: ReadonlyArray<TaskNode>,
) =>
  renderTaskMarkdownDocument(
    "All tasks",
    [],
    [
      Object.freeze({
        title: "Inbox",
        tasks: tasks.filter((task) => task.projectId === null && task.sectionId === null),
      }),
      ...sections
        .filter((section) => section.projectId === null)
        .map((section) =>
          Object.freeze({
            title: `Inbox / ${section.title}`,
            tasks: tasks.filter((task) => task.projectId === null && task.sectionId === section.id),
          }),
        ),
      ...projects.flatMap((project) => [
        Object.freeze({
          title: project.title,
          tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === null),
        }),
        ...sections
          .filter((section) => section.projectId === project.id)
          .map((section) =>
            Object.freeze({
              title: `${project.title} / ${section.title}`,
              tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === section.id),
            }),
          ),
      ]),
    ],
  );

export const allAdvancedMarkdownDocument = (
  projects: ReadonlyArray<Project>,
  sections: ReadonlyArray<Section>,
  tasks: ReadonlyArray<TaskNode>,
  inboxDescription: string,
) =>
  renderAdvancedMarkdownDocument(
    "All tasks",
    [],
    [
      Object.freeze({
        title: "Inbox",
        description: inboxDescription,
        tasks: tasks.filter((task) => task.projectId === null && task.sectionId === null),
      }),
      ...sections
        .filter((section) => section.projectId === null)
        .map((section) =>
          Object.freeze({
            title: `Inbox / ${section.title}`,
            tasks: tasks.filter((task) => task.projectId === null && task.sectionId === section.id),
          }),
        ),
      ...projects.flatMap((project) => [
        Object.freeze({
          title: project.title,
          description: project.description,
          tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === null),
        }),
        ...sections
          .filter((section) => section.projectId === project.id)
          .map((section) =>
            Object.freeze({
              title: `${project.title} / ${section.title}`,
              tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === section.id),
            }),
          ),
      ]),
    ],
  );

export const copyText = async (text: string) => {
  if (navigator.clipboard !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

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
