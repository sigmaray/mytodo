/**
 * String identifier used to reference a task from other tasks.
 *
 * @typedef {string} TaskId
 */
export type TaskId = string;
/**
 * String identifier of a project that can contain tasks and sections.
 *
 * @typedef {string} ProjectId
 */
export type ProjectId = string;
/**
 * String identifier of a section within a project.
 *
 * @typedef {string} SectionId
 */
export type SectionId = string;

/**
 * Complete task record shared by the domain logic and applications.
 *
 * @typedef {Object} Task
 * @property {TaskId} id - Unique task identifier.
 * @property {string} title - Task title.
 * @property {string} description - Task description.
 * @property {string | null} dueDate - Due date, or `null` when no date is set.
 * @property {Array<string>} labels - Labels assigned to the task.
 * @property {Array<Comment>} comments - Comments attached to the task.
 * @property {boolean} completed - Whether the task is complete.
 * @property {TaskId | null} parentId - Parent task ID, or `null` for a top-level task.
 * @property {ProjectId | null} projectId - Project ID, or `null` when the task is in the Inbox.
 * @property {SectionId | null} sectionId - Section ID, or `null` when the task is at the project root.
 * @property {string} lexicalOrder - Lexical position used to order sibling tasks.
 * @property {string} createdAt - Timestamp when the task was created.
 * @property {string} updatedAt - Timestamp when the task was last updated.
 */
export type Task = {
  id: TaskId;

  title: string;

  description: string;

  dueDate: string | null;

  labels: Array<string>;

  comments: Array<Comment>;

  completed: boolean;

  parentId: TaskId | null;

  projectId: ProjectId | null;

  sectionId: SectionId | null;

  lexicalOrder: string;

  createdAt: string;

  updatedAt: string;
};

/**
 * Metadata for a file attached to a comment.
 *
 * @typedef {Object} Attachment
 * @property {string} id - Unique attachment identifier.
 * @property {string} name - Original file name.
 * @property {string} mimeType - File MIME type.
 * @property {number} size - File size in bytes.
 */
export type Attachment = {
  id: string;

  name: string;

  mimeType: string;

  size: number;
};
/**
 * A message in a task discussion and its attached files.
 *
 * @typedef {Object} Comment
 * @property {string} id - Unique comment identifier.
 * @property {string} body - Comment text.
 * @property {string} createdAt - Timestamp when the comment was created.
 * @property {Array<Attachment>} [attachments] - Files attached to the comment.
 */
export type Comment = {
  id: string;

  body: string;

  createdAt: string;

  attachments?: Array<Attachment>;
};

/**
 * A task extended with its already-built list of child nodes.
 *
 * @typedef {Object} TaskNode
 * @property {Array<TaskNode>} children - Child tasks in display order.
 */
export type TaskNode = Task & {
  children: Array<TaskNode>;
};

/**
 * A project groups tasks and sections.
 *
 * @typedef {Object} Project
 * @property {ProjectId} id - Unique project identifier.
 * @property {string} title - Project title.
 * @property {string} description - Project description.
 * @property {boolean} archived - Whether the project is archived.
 * @property {ProjectId | null} parentId - Parent project ID, or `null` for a top-level project.
 * @property {string} lexicalOrder - Lexical position used to order sibling projects.
 * @property {string} createdAt - Timestamp when the project was created.
 * @property {string} updatedAt - Timestamp when the project was last updated.
 */
export type Project = {
  id: ProjectId;

  title: string;

  description: string;

  archived: boolean;

  parentId: ProjectId | null;

  lexicalOrder: string;

  createdAt: string;

  updatedAt: string;
};

/**
 * A section groups tasks within a project.
 *
 * @typedef {Object} Section
 * @property {SectionId} id - Unique section identifier.
 * @property {string} title - Section title.
 * @property {ProjectId | null} projectId - Owning project ID, or `null` for the Inbox.
 * @property {string} lexicalOrder - Lexical position used to order sections.
 * @property {string} createdAt - Timestamp when the section was created.
 * @property {string} updatedAt - Timestamp when the section was last updated.
 */
export type Section = {
  id: SectionId;

  title: string;

  projectId: ProjectId | null;

  lexicalOrder: string;

  createdAt: string;

  updatedAt: string;
};
