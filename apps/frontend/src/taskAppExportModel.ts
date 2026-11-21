import type { Comment, Project, ProjectId, Section, Task, TaskNode } from "@todoist-clone/domain";
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

/** Inbox data included in a complete workspace export.
 * @property {string} description - Inbox description, or an empty string when unset.
 * @property {Array<Section>} sections - Sections belonging to the Inbox.
 * @property {Array<Task>} tasks - Tasks belonging to the Inbox.
 */
type TaskAppExportInbox = {
  description: string;
  sections: Array<Section>;
  tasks: Array<Task>;
};

/** Project data and its contained sections and tasks in a complete export.
 * @property {Array<Section>} sections - Sections belonging to the project.
 * @property {Array<Task>} tasks - Tasks belonging to the project.
 */
type TaskAppExportProject = Project & {
  sections: Array<Section>;
  tasks: Array<Task>;
};

/** Due date paired with the task that owns it in a complete export.
 * @property {string} taskId - ID of the task with this due date.
 * @property {string | null} dueDate - Task due date.
 */
type TaskAppExportDate = {
  taskId: string;
  dueDate: string | null;
};

/** Comment paired with the task that owns it in a complete export.
 * @property {string} taskId - ID of the task with this comment.
 */
type TaskAppExportComment = Comment & { taskId: string };

/** Human-readable descriptions included in a complete workspace export.
 * @property {string} inbox - Inbox description.
 * @property {Array<{ id: string; description: string }>} projects - Project IDs and descriptions.
 * @property {Array<{ id: string; description: string }>} tasks - Task IDs and non-empty descriptions.
 */
type TaskAppExportDescriptions = {
  inbox: string;
  projects: Array<{ id: string; description: string }>;
  tasks: Array<{ id: string; description: string }>;
};

/** Complete versioned workspace export serialized as JSON.
 * @property {number} schemaVersion - Version used to identify the export format.
 * @property {string} exportedAt - UTC timestamp when the export was created.
 * @property {TaskAppExportInbox} inbox - Inbox description, sections, and tasks.
 * @property {Array<TaskAppExportProject>} projects - Projects with their sections and tasks.
 * @property {Array<Section>} sections - All workspace sections.
 * @property {Array<Task>} tasks - All tasks in a flat list.
 * @property {Array<TaskNode>} taskTree - All tasks in their nested tree form.
 * @property {Array<TaskAppExportDate>} dates - Due dates paired with task IDs.
 * @property {Array<TaskAppExportComment>} comments - Comments paired with task IDs.
 * @property {TaskAppExportDescriptions} descriptions - Descriptions grouped by entity type.
 */
type TaskAppFullExport = {
  schemaVersion: number;
  exportedAt: string;
  inbox: TaskAppExportInbox;
  projects: Array<TaskAppExportProject>;
  sections: Array<Section>;
  tasks: Array<Task>;
  taskTree: Array<TaskNode>;
  dates: Array<TaskAppExportDate>;
  comments: Array<TaskAppExportComment>;
  descriptions: TaskAppExportDescriptions;
};

/** Scope metadata included with a project or Inbox export.
 * @property {"inbox" | "project"} type - Kind of workspace scope being exported.
 * @property {ProjectId | null} id - Project ID, or `null` when exporting the Inbox.
 * @property {string} title - Display title for the selected scope.
 */
type TaskAppExportScope = {
  type: "inbox" | "project";
  id: ProjectId | null;
  title: string;
};

/** Description fields included in a scoped export.
 * @property {string} scope - Description for the selected scope.
 * @property {Array<{ id: string; description: string }>} tasks - Task IDs and non-empty descriptions.
 */
type TaskAppScopedExportDescriptions = {
  scope: string;
  tasks: Array<{ id: string; description: string }>;
};

/** Versioned data for a project-specific or Inbox-specific JSON export.
 * @property {number} schemaVersion - Version used to identify the export format.
 * @property {string} exportedAt - UTC timestamp when the export was created.
 * @property {TaskAppExportScope} scope - Type, ID, and title of the selected scope.
 * @property {TaskAppExportInbox | null} inbox - Inbox data when exporting the Inbox.
 * @property {TaskAppExportProject | null} project - Project data when exporting a project.
 * @property {Array<Section>} sections - Sections within the selected scope.
 * @property {Array<Task>} tasks - Tasks within the selected scope in a flat list.
 * @property {Array<TaskNode>} taskTree - Tasks within the selected scope in tree form.
 * @property {Array<TaskAppExportDate>} dates - Due dates paired with task IDs.
 * @property {Array<TaskAppExportComment>} comments - Comments paired with task IDs.
 * @property {TaskAppScopedExportDescriptions} descriptions - Descriptions included in the selected scope.
 */
type TaskAppScopedExport = {
  schemaVersion: number;
  exportedAt: string;
  scope: TaskAppExportScope;
  inbox: TaskAppExportInbox | null;
  project: TaskAppExportProject | null;
  sections: Array<Section>;
  tasks: Array<Task>;
  taskTree: Array<TaskNode>;
  dates: Array<TaskAppExportDate>;
  comments: Array<TaskAppExportComment>;
  descriptions: TaskAppScopedExportDescriptions;
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
  const allExportData: TaskAppFullExport = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    inbox: {
      description: inboxDescription ?? "",
      sections: allSections.filter((section) => section.projectId === null),
      tasks: flatTasks.filter((task) => task.projectId === null),
    },
    projects: allProjects.map((project) => ({
      ...project,
      sections: allSections.filter((section) => section.projectId === project.id),
      tasks: flatTasks.filter((task) => task.projectId === project.id),
    })),
    sections: allSections,
    tasks: flatTasks,
    taskTree: allTasks,
    dates: flatTasks
      .filter((task) => task.dueDate !== null)
      .map((task) => ({ taskId: task.id, dueDate: task.dueDate })),
    comments: flatTasks.flatMap((task) => task.comments.map((comment) => ({ ...comment, taskId: task.id }))),
    descriptions: {
      inbox: inboxDescription ?? "",
      projects: allProjects.map((project) => ({ id: project.id, description: project.description })),
      tasks: flatTasks
        .filter((task) => task.description.length > 0)
        .map((task) => ({ id: task.id, description: task.description })),
    },
  };
  const allJson = JSON.stringify(allExportData, null, 2);
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
  const scopedExportData: TaskAppScopedExport = {
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
    comments: scopeTasks.flatMap((task) => task.comments.map((comment) => ({ ...comment, taskId: task.id }))),
    descriptions: {
      scope: scopeDescription,
      tasks: scopeTasks
        .filter((task) => task.description.length > 0)
        .map((task) => ({ id: task.id, description: task.description })),
    },
  };
  const scopeJson = JSON.stringify(scopedExportData, null, 2);

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
