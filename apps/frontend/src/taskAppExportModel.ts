import type { Project, ProjectId, Section, Task, TaskNode } from "@todoist-clone/domain";
import {
  allAdvancedMarkdownDocument,
  allMarkdownDocument,
  currentAdvancedMarkdown,
  downloadBlob,
  filterTaskTree,
} from "./taskAppUtils";

/**
 * Current workspace data required to prepare export options.
 *
 * @typedef {Object} TaskAppExportModelInput
 * @property {Array<Project>} allProjects - All user projects.
 * @property {Array<Section>} allSections - All user sections.
 * @property {Array<TaskNode>} allTasks - All user tasks, including nested tasks.
 * @property {Array<Task>} flatTasks - Flat task list used to build exports.
 * @property {ProjectId | null} targetProjectId - Target project ID, or `null` for the Inbox.
 * @property {string} taskTargetLabel - Label for the task export scope.
 * @property {string | undefined} inboxDescription - Inbox description.
 */
type TaskAppExportModelInput = {
  allProjects: Array<Project>;

  allSections: Array<Section>;

  allTasks: Array<TaskNode>;

  flatTasks: Array<Task>;

  targetProjectId: ProjectId | null;

  taskTargetLabel: string;

  inboxDescription: string | undefined;
};

/**
 * Builds full and scoped Markdown/JSON exports and download actions.
 *
 * @param {TaskAppExportModelInput} parameter1
 * @returns Export content and download handlers.
 */
export const createTaskAppExportModel = ({
  allProjects,
  allSections,
  allTasks,
  flatTasks,
  targetProjectId,
  taskTargetLabel,
  inboxDescription,
}: TaskAppExportModelInput) => {
  /** The full export includes all entities and metadata for the schema version and creation time. */
  const allMarkdown = allMarkdownDocument(allProjects, allSections, allTasks);
  const allJson = JSON.stringify(
    {
      /** The schema version lets future importers identify the file format. */
      schemaVersion: 1,
      /** Store the time in UTC so the export has an unambiguous timestamp. */
      exportedAt: new Date().toISOString(),
      inbox: {
        /** The Inbox export includes its description, sections, and root tasks. */
        description: inboxDescription ?? "",
        sections: allSections.filter((section) => section.projectId === null),
        tasks: flatTasks.filter((task) => task.projectId === null),
      },
      projects: allProjects.map((project) => ({
        /** Project exports include project fields, sections, and tasks. */
        ...project,
        sections: allSections.filter((section) => section.projectId === project.id),
        tasks: flatTasks.filter((task) => task.projectId === project.id),
      })),
      sections: allSections,
      tasks: flatTasks,
      taskTree: allTasks,
      dates: flatTasks
        /** A separate due date list makes dates available without traversing every task. */
        .filter((task) => task.dueDate !== null)
        .map((task) => ({ taskId: task.id, dueDate: task.dueDate })),
      comments: flatTasks.flatMap((task) =>
        /** The task ID associates each comment with its owner. */
        task.comments.map((comment) => ({ ...comment, taskId: task.id })),
      ),
      descriptions: {
        inbox: inboxDescription ?? "",
        projects: allProjects.map((project) => ({ id: project.id, description: project.description })),
        tasks: flatTasks
          .filter((task) => task.description.length > 0)
          .map((task) => ({ id: task.id, description: task.description })),
      },
    },
    null,
    2,
  );
  /** Scope the current export to the open project or the Inbox. */
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
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      scope: {
        type: targetProjectId === null ? "inbox" : "project",
        id: targetProjectId,
        title: targetProjectId === null ? "Inbox" : (scopeProject?.title ?? taskTargetLabel),
      },
      inbox:
        targetProjectId === null
          ? { description: scopeDescription, sections: scopeSections, tasks: scopeTasks }
          : null,
      project: scopeProject === null ? null : { ...scopeProject, sections: scopeSections, tasks: scopeTasks },
      sections: scopeSections,
      tasks: scopeTasks,
      taskTree: scopeTaskTree,
      dates: scopeTasks
        .filter((task) => task.dueDate !== null)
        .map((task) => ({ taskId: task.id, dueDate: task.dueDate })),
      comments: scopeTasks.flatMap((task) =>
        task.comments.map((comment) => ({ ...comment, taskId: task.id })),
      ),
      descriptions: {
        scope: scopeDescription,
        tasks: scopeTasks
          .filter((task) => task.description.length > 0)
          .map((task) => ({ id: task.id, description: task.description })),
      },
    },
    null,
    2,
  );

  return {
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
  };
};
