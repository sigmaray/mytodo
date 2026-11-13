import type { Comment, Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";

export type TaskCommentPatch = {
  id?: string;
  body: string;
  attachments?: Comment["attachments"];
};

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

export type TaskMove = {
  parentId: TaskId | null;
  projectId: ProjectId | null;
  sectionId: SectionId | null;
  beforeId: TaskId | null;
  afterId: TaskId | null;
};

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
  updateProject: (id: ProjectId, patch: { title?: string; description?: string }) => Promise<Project | null>;
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

export { createMemoryTaskRepository } from "./memoryTaskRepository";
