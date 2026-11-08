import { generateLexicalOrder } from "@todoist-clone/domain";
import type { Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";

export type TaskPatch = Readonly<{
  title?: string;
  description?: string;
  dueDate?: string | null;
  labels?: ReadonlyArray<string>;
  comments?: Task["comments"];
  completed?: boolean;
  projectId?: ProjectId | null;
  sectionId?: SectionId | null;
}>;

export type TaskMove = Readonly<{
  parentId: TaskId | null;
  projectId: ProjectId | null;
  sectionId: SectionId | null;
  beforeId: TaskId | null;
  afterId: TaskId | null;
}>;

export type TaskRepository = Readonly<{
  list: () => Promise<ReadonlyArray<Task>>;
  listProjects: () => Promise<ReadonlyArray<Project>>;
  createProject: (title: string) => Promise<Project>;
  createSubproject: (title: string, parentId: ProjectId) => Promise<Project>;
  moveProject: (id: ProjectId, parentId: ProjectId | null) => Promise<Project | null>;
  reorderProject: (id: ProjectId, beforeId: ProjectId | null, afterId: ProjectId | null) => Promise<Project | null>;
  updateProject: (id: ProjectId, patch: Readonly<{ title?: string; description?: string }>) => Promise<Project | null>;
  deleteProject: (id: ProjectId) => Promise<boolean>;
  duplicateProject: (id: ProjectId) => Promise<Project | null>;
  setProjectArchived: (id: ProjectId, archived: boolean) => Promise<Project | null>;
  listSections: () => Promise<ReadonlyArray<Section>>;
  reorderSection: (id: SectionId, beforeId: SectionId | null, afterId: SectionId | null) => Promise<Section | null>;
  createSection: (title: string, projectId: ProjectId | null) => Promise<Section>;
  updateSection: (id: SectionId, title: string) => Promise<Section | null>;
  deleteSection: (id: SectionId) => Promise<boolean>;
  create: (
    title: string,
    parentId: TaskId | null,
    projectId: ProjectId | null,
    sectionId: SectionId | null
  ) => Promise<Task>;
  patch: (id: TaskId, patch: TaskPatch) => Promise<Task | null>;
  move: (id: TaskId, move: TaskMove) => Promise<Task | null>;
  delete: (id: TaskId) => Promise<boolean>;
}>;

const now = () => new Date().toISOString();

const collectDescendantIds = (allTasks: ReadonlyArray<Task>, id: TaskId): ReadonlyArray<TaskId> =>
  Object.freeze([
    id,
    ...allTasks
      .filter((task) => task.parentId === id)
      .flatMap((task) => collectDescendantIds(allTasks, task.id))
  ]);

const compareOrder = (left: Task, right: Task): number =>
  left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0;

const findSiblingOrder = (
  tasks: ReadonlyArray<Task>,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
  beforeId: TaskId | null,
  afterId: TaskId | null
) => {
  const siblings = tasks
    .filter((task) => task.parentId === parentId && task.projectId === projectId && task.sectionId === sectionId)
    .toSorted(compareOrder);
  const successorIndex = beforeId === null ? -1 : siblings.findIndex((task) => task.id === beforeId);
  const predecessorIndex = afterId === null ? -1 : siblings.findIndex((task) => task.id === afterId);
  const low =
    predecessorIndex >= 0
      ? siblings[predecessorIndex]?.lexicalOrder ?? null
      : beforeId === null && afterId === null
        ? siblings.at(-1)?.lexicalOrder ?? null
        : null;
  const high = successorIndex >= 0 ? siblings[successorIndex]?.lexicalOrder ?? null : null;

  return generateLexicalOrder(low, high);
};

export const createMemoryTaskRepository = (
  initialTasks: ReadonlyArray<Task> = Object.freeze([])
): TaskRepository => {
  let tasks = Object.freeze(initialTasks.map((task) => Object.freeze({ ...task })));
  let projects = Object.freeze([] as ReadonlyArray<Project>);
  let sections = Object.freeze([] as ReadonlyArray<Section>);

  const replace = (nextTasks: ReadonlyArray<Task>) => {
    tasks = Object.freeze(nextTasks.map((task) => Object.freeze({ ...task })));
  };

  return Object.freeze({
    list: async () => tasks,
    listProjects: async () => projects,
    createProject: async (title) => {
      const createdAt = now();
      const siblings = projects.filter((project) => project.parentId === null).toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const project = Object.freeze({
        id: crypto.randomUUID(),
        title,
        description: "",
        archived: false,
        parentId: null,
        lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        createdAt,
        updatedAt: createdAt
      });

      projects = Object.freeze([...projects, project]);

      return project;
    },
    createSubproject: async (title, parentId) => {
      if (!projects.some((project) => project.id === parentId)) throw new Error("Parent project not found");
      const createdAt = now();
      const siblings = projects.filter((item) => item.parentId === parentId).toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const project = Object.freeze({ id: crypto.randomUUID(), title, description: "", archived: false, parentId, lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null), createdAt, updatedAt: createdAt });
      projects = Object.freeze([...projects, project]);
      return project;
    },
    moveProject: async (id, parentId) => {
      const existing = projects.find((item) => item.id === id);
      if (!existing || (parentId !== null && !projects.some((item) => item.id === parentId)) || parentId === id) return null;
      let ancestor = parentId;
      while (ancestor !== null) { if (ancestor === id) return null; ancestor = projects.find((item) => item.id === ancestor)?.parentId ?? null; }
      const siblings = projects.filter((item) => item.parentId === parentId && item.id !== id).toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const moved = Object.freeze({ ...existing, parentId, lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null), updatedAt: now() });
      projects = Object.freeze(projects.map((item) => item.id === id ? moved : item));
      return moved;
    },
    reorderProject: async (id, beforeId, afterId) => {
      const existing = projects.find((project) => project.id === id);
      if (!existing) return null;
      const ordered = projects.filter((project) => project.parentId === existing.parentId && project.id !== id).toSorted((left, right) => left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0);
      const beforeIndex = beforeId === null ? -1 : ordered.findIndex((project) => project.id === beforeId);
      const afterIndex = afterId === null ? -1 : ordered.findIndex((project) => project.id === afterId);
      const low = afterIndex >= 0 ? ordered[afterIndex]?.lexicalOrder ?? null : beforeId === null && afterId === null ? ordered.at(-1)?.lexicalOrder ?? null : null;
      const high = beforeIndex >= 0 ? ordered[beforeIndex]?.lexicalOrder ?? null : null;
      const reordered = Object.freeze({ ...existing, lexicalOrder: generateLexicalOrder(low, high), updatedAt: now() });
      projects = Object.freeze(projects.map((project) => project.id === id ? reordered : project).toSorted((left, right) => left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0));
      return reordered;
    },
    updateProject: async (id, patch) => {
      const existing = projects.find((project) => project.id === id);

      if (existing === undefined) {
        return null;
      }

      const updated = Object.freeze({
        ...existing,
        ...patch,
        updatedAt: now()
      });

      projects = Object.freeze(projects.map((project) => (project.id === id ? updated : project)));

      return updated;
    },
    deleteProject: async (id) => {
      const existing = projects.find((project) => project.id === id);

      if (existing === undefined) {
        return false;
      }

      const projectSectionIds = new Set(sections.filter((section) => section.projectId === id).map((section) => section.id));
      const doomedRootIds = tasks
        .filter((task) => task.projectId === id || (task.sectionId !== null && projectSectionIds.has(task.sectionId)))
        .map((task) => task.id);
      const doomedIds = new Set(doomedRootIds.flatMap((taskId) => collectDescendantIds(tasks, taskId)));

      replace(tasks.filter((task) => !doomedIds.has(task.id)));
      sections = Object.freeze(sections.filter((section) => section.projectId !== id));
      projects = Object.freeze(projects.filter((project) => project.id !== id).map((project) => project.parentId === id ? Object.freeze({ ...project, parentId: existing.parentId, updatedAt: now() }) : project));

      return true;
    },
    duplicateProject: async (id) => {
      const source = projects.find((project) => project.id === id);
      if (source === undefined) return null;
      const createdAt = now();
      const siblingProjects = projects.filter((project) => project.parentId === source.parentId).toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const duplicated = Object.freeze({ ...source, id: crypto.randomUUID(), title: `${source.title} copy`, archived: false, lexicalOrder: generateLexicalOrder(source.lexicalOrder, siblingProjects.find((project) => project.lexicalOrder > source.lexicalOrder)?.lexicalOrder ?? null), createdAt, updatedAt: createdAt });
      const sourceSections = sections.filter((section) => section.projectId === id);
      const sectionMap = new Map(sourceSections.map((section) => [section.id, crypto.randomUUID()]));
      const newSections = sourceSections.map((section) => Object.freeze({ ...section, id: sectionMap.get(section.id)!, projectId: duplicated.id, createdAt, updatedAt: createdAt }));
      const sourceTasks = tasks.filter((task) => task.projectId === id);
      const taskMap = new Map(sourceTasks.map((task) => [task.id, crypto.randomUUID()]));
      const newTasks = sourceTasks.map((task) => Object.freeze({ ...task, id: taskMap.get(task.id)!, projectId: duplicated.id, sectionId: task.sectionId === null ? null : sectionMap.get(task.sectionId) ?? null, parentId: task.parentId === null ? null : taskMap.get(task.parentId) ?? null, createdAt, updatedAt: createdAt }));
      projects = Object.freeze([...projects, duplicated]);
      sections = Object.freeze([...sections, ...newSections]);
      replace([...tasks, ...newTasks]);
      return duplicated;
    },
    setProjectArchived: async (id, archived) => {
      const existing = projects.find((project) => project.id === id);
      if (existing === undefined) return null;
      const updated = Object.freeze({ ...existing, archived, updatedAt: now() });
      projects = Object.freeze(projects.map((project) => project.id === id ? updated : project));
      return updated;
    },
    listSections: async () => sections,
    reorderSection: async (id, beforeId, afterId) => {
      const section = sections.find((item) => item.id === id);
      if (!section) return null;
      const siblings = sections.filter((item) => item.projectId === section.projectId && item.id !== id).toSorted((left, right) => left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0);
      const beforeIndex = beforeId === null ? -1 : siblings.findIndex((item) => item.id === beforeId);
      const afterIndex = afterId === null ? -1 : siblings.findIndex((item) => item.id === afterId);
      const low = afterIndex >= 0 ? siblings[afterIndex]?.lexicalOrder ?? null : beforeId === null && afterId === null ? siblings.at(-1)?.lexicalOrder ?? null : null;
      const high = beforeIndex >= 0 ? siblings[beforeIndex]?.lexicalOrder ?? null : null;
      const reordered = Object.freeze({ ...section, lexicalOrder: generateLexicalOrder(low, high), updatedAt: now() });
      sections = Object.freeze(sections.map((item) => item.id === id ? reordered : item).toSorted((left, right) => left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0));
      return reordered;
    },
    createSection: async (title, projectId) => {
      const createdAt = now();
      const siblings = sections.filter((section) => section.projectId === projectId);
      const section = Object.freeze({
        id: crypto.randomUUID(),
        title,
        projectId,
        lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        createdAt,
        updatedAt: createdAt
      });

      sections = Object.freeze([...sections, section]);

      return section;
    },
    updateSection: async (id, title) => {
      const existing = sections.find((section) => section.id === id);

      if (existing === undefined) {
        return null;
      }

      const updated = Object.freeze({
        ...existing,
        title,
        updatedAt: now()
      });

      sections = Object.freeze(sections.map((section) => (section.id === id ? updated : section)));

      return updated;
    },
    deleteSection: async (id) => {
      const existing = sections.find((section) => section.id === id);

      if (existing === undefined) {
        return false;
      }

      sections = Object.freeze(sections.filter((section) => section.id !== id));
      replace(tasks.map((task) => (task.sectionId === id ? Object.freeze({ ...task, parentId: null, sectionId: null, updatedAt: now() }) : task)));

      return true;
    },
    create: async (title, parentId, projectId, sectionId) => {
      const createdAt = now();
      const task = Object.freeze({
        id: crypto.randomUUID(),
        title,
        description: "",
        dueDate: null,
        labels: Object.freeze([]),
        comments: Object.freeze([]),
        completed: false,
        parentId,
        projectId,
        sectionId,
        lexicalOrder: findSiblingOrder(tasks, parentId, projectId, sectionId, null, null),
        createdAt,
        updatedAt: createdAt
      });

      replace([...tasks, task]);

      return task;
    },
    patch: async (id, patch) => {
      const existing = tasks.find((task) => task.id === id);

      if (existing === undefined) {
        return null;
      }

      const updated = Object.freeze({
        ...existing,
        ...patch,
        updatedAt: now()
      });

      replace(tasks.map((task) => (task.id === id ? updated : task)));

      return updated;
    },
    move: async (id, move) => {
      const existing = tasks.find((task) => task.id === id);

      if (existing === undefined) {
        return null;
      }

      const updated = Object.freeze({
        ...existing,
        parentId: move.parentId,
        projectId: move.projectId,
        sectionId: move.sectionId,
        lexicalOrder: findSiblingOrder(
          tasks.filter((task) => task.id !== id),
          move.parentId,
          move.projectId,
          move.sectionId,
          move.beforeId,
          move.afterId
        ),
        updatedAt: now()
      });

      replace(tasks.map((task) => (task.id === id ? updated : task)));

      return updated;
    },
    delete: async (id) => {
      const existing = tasks.find((task) => task.id === id);

      if (existing === undefined) {
        return false;
      }

      const deletedIds = new Set(collectDescendantIds(tasks, id));

      replace(tasks.filter((task) => !deletedIds.has(task.id)));

      return true;
    }
  });
};
