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
 * Returns all tasks belonging to the repository's user.
 *
 * @callback TaskRepositoryList
 * @returns {Promise<Array<Task>>}
 */

/**
 * Returns all projects belonging to the user.
 *
 * @callback TaskRepositoryListProjects
 * @returns {Promise<Array<Project>>}
 */

/**
 * Creates a top-level project.
 *
 * @callback TaskRepositoryCreateProject
 * @param {string} title
 * @returns {Promise<Project>}
 */

/**
 * Creates a nested project under the specified parent.
 *
 * @callback TaskRepositoryCreateSubproject
 * @param {string} title
 * @param {ProjectId} parentId
 * @returns {Promise<Project>}
 */

/**
 * Changes a project's parent or moves it to the root.
 *
 * @callback TaskRepositoryMoveProject
 * @param {ProjectId} id
 * @param {ProjectId | null} parentId
 * @returns {Promise<Project | null>}
 */

/**
 * Reorders a project among its siblings at the same tree level.
 *
 * @callback TaskRepositoryReorderProject
 * @param {ProjectId} id
 * @param {ProjectId | null} beforeId
 * @param {ProjectId | null} afterId
 * @returns {Promise<Project | null>}
 */

/**
 * Updates a project's name and/or description.
 *
 * @callback TaskRepositoryUpdateProject
 * @param {ProjectId} id
 * @param {{ title?: string; description?: string; }} patch
 * @param {string} patch.title - New project title.
 * @param {string} patch.description - New project description.
 * @returns {Promise<Project | null>}
 */

/**
 * Deletes a project and reports whether it existed.
 *
 * @callback TaskRepositoryDeleteProject
 * @param {ProjectId} id
 * @returns {Promise<boolean>}
 */

/**
 * Duplicates an existing project and its contents.
 *
 * @callback TaskRepositoryDuplicateProject
 * @param {ProjectId} id
 * @returns {Promise<Project | null>}
 */

/**
 * Archives a project or restores it to the active list.
 *
 * @callback TaskRepositorySetProjectArchived
 * @param {ProjectId} id
 * @param {boolean} archived
 * @returns {Promise<Project | null>}
 */

/**
 * Returns all sections belonging to the user.
 *
 * @callback TaskRepositoryListSections
 * @returns {Promise<Array<Section>>}
 */

/**
 * Reorders a section relative to other sections in the same list.
 *
 * @callback TaskRepositoryReorderSection
 * @param {SectionId} id
 * @param {SectionId | null} beforeId
 * @param {SectionId | null} afterId
 * @returns {Promise<Section | null>}
 */

/**
 * Creates a section in a project or in the Inbox.
 *
 * @callback TaskRepositoryCreateSection
 * @param {string} title
 * @param {ProjectId | null} projectId
 * @returns {Promise<Section>}
 */

/**
 * Renames a section.
 *
 * @callback TaskRepositoryUpdateSection
 * @param {SectionId} id
 * @param {string} title
 * @returns {Promise<Section | null>}
 */

/**
 * Deletes a section and reports whether it existed.
 *
 * @callback TaskRepositoryDeleteSection
 * @param {SectionId} id
 * @returns {Promise<boolean>}
 */

/**
 * Creates a task in the specified parent and project context.
 *
 * @callback TaskRepositoryCreate
 * @param {string} title
 * @param {TaskId | null} parentId
 * @param {ProjectId | null} projectId
 * @param {SectionId | null} sectionId
 * @returns {Promise<Task>}
 */

/**
 * Applies a partial update to a task.
 *
 * @callback TaskRepositoryPatch
 * @param {TaskId} id
 * @param {TaskPatch} patch
 * @returns {Promise<Task | null>}
 */

/**
 * Adds a comment and reports whether the task was found.
 *
 * @callback TaskRepositoryAddComment
 * @param {TaskId} id
 * @param {Task["comments"][number]} comment
 * @returns {Promise<boolean>}
 */

/**
 * Moves a task and returns the updated record.
 *
 * @callback TaskRepositoryMove
 * @param {TaskId} id
 * @param {TaskMove} move
 * @returns {Promise<Task | null>}
 */

/**
 * Deletes a task and reports whether it existed.
 *
 * @callback TaskRepositoryDelete
 * @param {TaskId} id
 * @returns {Promise<boolean>}
 */
/**
 * Task, project, and section repository contract used by server routes.
 *
 * @typedef {Object} TaskRepository
 * @property {TaskRepositoryList} list - Returns the user's tasks in an order suitable for building the tree.
 * @property {TaskRepositoryListProjects} listProjects - Returns the user's projects.
 * @property {TaskRepositoryCreateProject} createProject - Creates a top-level project.
 * @property {TaskRepositoryCreateSubproject} createSubproject - Creates a nested project.
 * @property {TaskRepositoryMoveProject} moveProject - Changes a project's parent or moves it to the root.
 * @property {TaskRepositoryReorderProject} reorderProject - Reorders a project among its siblings.
 * @property {TaskRepositoryUpdateProject} updateProject - Updates a project's name and description.
 * @property {TaskRepositoryDeleteProject} deleteProject - Deletes a project.
 * @property {TaskRepositoryDuplicateProject} duplicateProject - Duplicates a project and its contents.
 * @property {TaskRepositorySetProjectArchived} setProjectArchived - Archives a project or restores it to the active list.
 * @property {TaskRepositoryListSections} listSections - Returns the user's sections.
 * @property {TaskRepositoryReorderSection} reorderSection - Reorders a section among its siblings.
 * @property {TaskRepositoryCreateSection} createSection - Creates a section in a project or in the Inbox.
 * @property {TaskRepositoryUpdateSection} updateSection - Renames a section.
 * @property {TaskRepositoryDeleteSection} deleteSection - Deletes a section.
 * @property {TaskRepositoryCreate} create - Creates a task in the specified context.
 * @property {TaskRepositoryPatch} patch - Applies partial updates to a task.
 * @property {TaskRepositoryAddComment} addComment - Adds a comment to a task.
 * @property {TaskRepositoryMove} move - Moves a task to a new position in the tree.
 * @property {TaskRepositoryDelete} delete - Deletes a task and reports whether it existed.
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
