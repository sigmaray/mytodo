import type { Project, ProjectId, Section, Task, TaskNode } from "@todoist-clone/domain";
import {
  allAdvancedMarkdownDocument,
  allMarkdownDocument,
  currentAdvancedMarkdown,
  downloadBlob,
  filterTaskTree,
} from "./taskAppUtils";

type TaskAppExportModelInput = Readonly<{
  allProjects: ReadonlyArray<Project>;
  allSections: ReadonlyArray<Section>;
  allTasks: ReadonlyArray<TaskNode>;
  flatTasks: ReadonlyArray<Task>;
  targetProjectId: ProjectId | null;
  taskTargetLabel: string;
  inboxDescription: string | undefined;
}>;

export const createTaskAppExportModel = ({
  allProjects,
  allSections,
  allTasks,
  flatTasks,
  targetProjectId,
  taskTargetLabel,
  inboxDescription,
}: TaskAppExportModelInput) => {
  const allMarkdown = allMarkdownDocument(allProjects, allSections, allTasks);
  const allJson = JSON.stringify(
    Object.freeze({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      inbox: Object.freeze({
        description: inboxDescription ?? "",
        sections: allSections.filter((section) => section.projectId === null),
        tasks: flatTasks.filter((task) => task.projectId === null),
      }),
      projects: allProjects.map((project) =>
        Object.freeze({
          ...project,
          sections: allSections.filter((section) => section.projectId === project.id),
          tasks: flatTasks.filter((task) => task.projectId === project.id),
        }),
      ),
      sections: allSections,
      tasks: flatTasks,
      taskTree: allTasks,
      dates: flatTasks
        .filter((task) => task.dueDate !== null)
        .map((task) => Object.freeze({ taskId: task.id, dueDate: task.dueDate })),
      comments: flatTasks.flatMap((task) =>
        task.comments.map((comment) => Object.freeze({ ...comment, taskId: task.id })),
      ),
      descriptions: Object.freeze({
        inbox: inboxDescription ?? "",
        projects: allProjects.map((project) =>
          Object.freeze({ id: project.id, description: project.description }),
        ),
        tasks: flatTasks
          .filter((task) => task.description.length > 0)
          .map((task) => Object.freeze({ id: task.id, description: task.description })),
      }),
    }),
    null,
    2,
  );
  const scopeProject =
    targetProjectId === null ? null : (allProjects.find((project) => project.id === targetProjectId) ?? null);
  const scopeSections = allSections.filter((section) => section.projectId === targetProjectId);
  const scopeTasks = flatTasks.filter((task) => task.projectId === targetProjectId);
  const scopeTaskTree = filterTaskTree(allTasks, (task) => task.projectId === targetProjectId);
  const scopeDescription =
    targetProjectId === null ? (inboxDescription ?? "") : (scopeProject?.description ?? "");
  const advancedMarkdown = currentAdvancedMarkdown(
    taskTargetLabel,
    allSections,
    allTasks,
    targetProjectId,
    scopeDescription,
  );
  const allAdvancedMarkdown = allAdvancedMarkdownDocument(
    allProjects,
    allSections,
    allTasks,
    inboxDescription ?? "",
  );
  const scopeJson = JSON.stringify(
    Object.freeze({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      scope: Object.freeze({
        type: targetProjectId === null ? "inbox" : "project",
        id: targetProjectId,
        title: targetProjectId === null ? "Inbox" : (scopeProject?.title ?? taskTargetLabel),
      }),
      inbox:
        targetProjectId === null
          ? Object.freeze({ description: scopeDescription, sections: scopeSections, tasks: scopeTasks })
          : null,
      project:
        scopeProject === null
          ? null
          : Object.freeze({ ...scopeProject, sections: scopeSections, tasks: scopeTasks }),
      sections: scopeSections,
      tasks: scopeTasks,
      taskTree: scopeTaskTree,
      dates: scopeTasks
        .filter((task) => task.dueDate !== null)
        .map((task) => Object.freeze({ taskId: task.id, dueDate: task.dueDate })),
      comments: scopeTasks.flatMap((task) =>
        task.comments.map((comment) => Object.freeze({ ...comment, taskId: task.id })),
      ),
      descriptions: Object.freeze({
        scope: scopeDescription,
        tasks: scopeTasks
          .filter((task) => task.description.length > 0)
          .map((task) => Object.freeze({ id: task.id, description: task.description })),
      }),
    }),
    null,
    2,
  );

  return Object.freeze({
    allMarkdown,
    allJson,
    scopeProject,
    advancedMarkdown,
    allAdvancedMarkdown,
    scopeJson,
    exportMarkdown: () =>
      downloadBlob(new Blob([allMarkdown], { type: "text/markdown;charset=utf-8" }), "mytodo.md"),
    exportAdvancedMarkdown: () =>
      downloadBlob(
        new Blob([allAdvancedMarkdown], { type: "text/markdown;charset=utf-8" }),
        "mytodo-advanced.md",
      ),
  });
};
