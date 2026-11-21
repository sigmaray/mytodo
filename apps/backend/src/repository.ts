import type { Comment, Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";

/**
 * Comment fields that can be changed when updating a task.
 *
 * @typedef {Object} TaskCommentPatch
 * @property {string} [id] - Comment ID, when updating an existing comment.
 * @property {string} body - Comment text.
 * @property {Comment["attachments"]} [attachments] - Files attached to the comment.
 */
export type TaskCommentPatch = {
  id?: string;

  body: string;

  attachments?: Comment["attachments"];
};

/**
 * Task fields that can be changed by a partial update.
 *
 * @typedef {Object} TaskPatch
 * @property {string} [title] - New task title.
 * @property {string} [description] - New task description.
 * @property {string | null} [dueDate] - New due date, or `null` to clear it.
 * @property {Array<string>} [labels] - Replacement list of task labels.
 * @property {Array<TaskCommentPatch>} [comments] - Updated list of task comments.
 * @property {boolean} [completed] - New completion status.
 * @property {ProjectId | null} [projectId] - Destination project ID, or `null` for the Inbox.
 * @property {SectionId | null} [sectionId] - Destination section ID, or `null` for the project root.
 */
export type TaskPatch = {
  title?: string;

  description?: string;

  dueDate?: string | null;

  labels?: Array<string>;

  comments?: Array<TaskCommentPatch>;

  completed?: boolean;

  projectId?: ProjectId | null;

  sectionId?: SectionId | null;
};

/**
 * Task destination and neighboring tasks used to determine its position.
 *
 * @typedef {Object} TaskMove
 * @property {TaskId | null} parentId - New parent task ID, or `null` for a top-level task.
 * @property {ProjectId | null} projectId - Destination project ID, or `null` for the Inbox.
 * @property {SectionId | null} sectionId - Destination section ID, or `null` for the project root.
 * @property {TaskId | null} beforeId - Neighboring task ID to place this task before.
 * @property {TaskId | null} afterId - Neighboring task ID to place this task after.
 */
export type TaskMove = {
  parentId: TaskId | null;

  projectId: ProjectId | null;

  sectionId: SectionId | null;

  beforeId: TaskId | null;

  afterId: TaskId | null;
};

/**
 * Task, project, and section repository contract used by server routes.
 *
 * @typedef {Object} TaskRepository
 * @property list - Returns the user's tasks in an order suitable for building the tree.
 * @property listProjects - Returns the user's projects.
 * @property createProject - Creates a top-level project.
 * @property createSubproject - Creates a nested project.
 * @property moveProject - Changes a project's parent or moves it to the root.
 * @property reorderProject - Reorders a project among its siblings.
 * @property updateProject - Updates a project's name and description.
 * @property deleteProject - Deletes a project.
 * @property duplicateProject - Duplicates a project and its contents.
 * @property setProjectArchived - Archives a project or restores it to the active list.
 * @property listSections - Returns the user's sections.
 * @property reorderSection - Reorders a section among its siblings.
 * @property createSection - Creates a section in a project or in the Inbox.
 * @property updateSection - Renames a section.
 * @property deleteSection - Deletes a section.
 * @property create - Creates a task in the specified context.
 * @property patch - Applies partial updates to a task.
 * @property addComment - Adds a comment to a task.
 * @property move - Moves a task to a new position in the tree.
 * @property delete - Deletes a task and reports whether it existed.
 */
export type TaskRepository = {
  list: () => Promise<Array<Task>>;

  listProjects: () => Promise<Array<Project>>;

  createProject: (title: string) => Promise<Project>;

  createSubproject: (title: string, parentId: ProjectId) => Promise<Project>;

  moveProject: (id: ProjectId, parentId: ProjectId | null) => Promise<Project | null>;

  reorderProject: (
    id: ProjectId,

    beforeId: ProjectId | null,

    afterId: ProjectId | null,
  ) => Promise<Project | null>;

  updateProject: (
    id: ProjectId,

    patch: {
      title?: string;

      description?: string;
    },
  ) => Promise<Project | null>;

  deleteProject: (id: ProjectId) => Promise<boolean>;

  duplicateProject: (id: ProjectId) => Promise<Project | null>;

  setProjectArchived: (id: ProjectId, archived: boolean) => Promise<Project | null>;

  listSections: () => Promise<Array<Section>>;

  reorderSection: (
    id: SectionId,

    beforeId: SectionId | null,

    afterId: SectionId | null,
  ) => Promise<Section | null>;

  createSection: (title: string, projectId: ProjectId | null) => Promise<Section>;

  updateSection: (id: SectionId, title: string) => Promise<Section | null>;

  deleteSection: (id: SectionId) => Promise<boolean>;

  create: (
    title: string,

    parentId: TaskId | null,

    projectId: ProjectId | null,

    sectionId: SectionId | null,
  ) => Promise<Task>;

  patch: (id: TaskId, patch: TaskPatch) => Promise<Task | null>;

  addComment: (id: TaskId, comment: Task["comments"][number]) => Promise<boolean>;

  move: (id: TaskId, move: TaskMove) => Promise<Task | null>;

  delete: (id: TaskId) => Promise<boolean>;
};

/** Exports the in-memory repository for development and tests. */
export { createMemoryTaskRepository } from "./memoryTaskRepository";
