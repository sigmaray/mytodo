export type TaskId = string;
export type ProjectId = string;
export type SectionId = string;

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

export type Attachment = { id: string; name: string; mimeType: string; size: number };
export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  attachments?: Array<Attachment>;
};

export type TaskNode = Task & {
  children: Array<TaskNode>;
};

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

export type Section = {
  id: SectionId;
  title: string;
  projectId: ProjectId | null;
  lexicalOrder: string;
  createdAt: string;
  updatedAt: string;
};
