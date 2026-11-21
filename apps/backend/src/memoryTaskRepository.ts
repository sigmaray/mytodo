import type { Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";
import { generateLexicalOrder } from "@todoist-clone/domain";
import type { TaskRepository } from "./repository";

/**
 * Returns the current time in the format used by domain models.
 */
const now = () => new Date().toISOString();

/**
 * Collects a task ID and all descendant IDs for cascading deletion.
 *
 * @param {Array<Task>} allTasks
 * @param {TaskId} id
 * @returns {Array<TaskId>}
 */
const collectDescendantIds = (allTasks: Array<Task>, id: TaskId): Array<TaskId> => [
  id,
  ...allTasks
    .filter((task) => task.parentId === id)
    .flatMap((task) => collectDescendantIds(allTasks, task.id)),
];

/**
 * Checks whether assigning a parent would create a cycle in the task hierarchy.
 *
 * @param {Array<Task>} tasks
 * @param {TaskId} taskId
 * @param {TaskId | null} parentId
 * @returns {boolean}
 */
const wouldCreateTaskCycle = (tasks: Array<Task>, taskId: TaskId, parentId: TaskId | null): boolean => {
  /**
   * Walk up from the proposed parent and look for the task itself or a previously visited node.
   *
   * @param {TaskId | null} ancestorId
   * @param {Array<TaskId>} visited
   * @returns {boolean}
   */
  const followsParentChain = (ancestorId: TaskId | null, visited: Array<TaskId>): boolean => {
    if (ancestorId === null) return false;
    if (ancestorId === taskId || visited.includes(ancestorId)) return true;
    const parent = tasks.find((task) => task.id === ancestorId);
    return followsParentChain(parent?.parentId ?? null, [...visited, ancestorId]);
  };
  return followsParentChain(parentId, []);
};

/**
 * Compares tasks by their string-based manual sort keys.
 *
 * @param {Task} left
 * @param {Task} right
 * @returns {number}
 */
const compareOrder = (left: Task, right: Task): number =>
  left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0;

/**
 * Computes a fractional key between neighboring tasks in the given list.
 *
 * @param {Array<Task>} tasks
 * @param {TaskId | null} parentId
 * @param {ProjectId | null} projectId
 * @param {SectionId | null} sectionId
 * @param {TaskId | null} beforeId
 * @param {TaskId | null} afterId
 * @returns The computed fractional sort key.
 */
const findSiblingOrder = (
  tasks: Array<Task>,
  parentId: TaskId | null,
  projectId: ProjectId | null,
  sectionId: SectionId | null,
  beforeId: TaskId | null,
  afterId: TaskId | null,
) => {
  const siblings = tasks
    .filter(
      (task) => task.parentId === parentId && task.projectId === projectId && task.sectionId === sectionId,
    )
    .toSorted(compareOrder);
  const successorIndex = beforeId === null ? -1 : siblings.findIndex((task) => task.id === beforeId);
  const predecessorIndex = afterId === null ? -1 : siblings.findIndex((task) => task.id === afterId);
  const low =
    predecessorIndex >= 0
      ? (siblings[predecessorIndex]?.lexicalOrder ?? null)
      : beforeId === null && afterId === null
        ? (siblings.at(-1)?.lexicalOrder ?? null)
        : null;
  const high = successorIndex >= 0 ? (siblings[successorIndex]?.lexicalOrder ?? null) : null;

  return generateLexicalOrder(low, high);
};

/**
 * Creates an in-memory task, project, and section repository without a database connection.
 *
 * @param {Array<Task>} [initialTasks]
 * @returns {TaskRepository}
 */
export const createMemoryTaskRepository = (initialTasks: Array<Task> = []): TaskRepository => {
  /** Copy the input so the repository does not mutate the supplied array. */
  let tasks = initialTasks.map((task) => ({ ...task }));
  let projects = [] as Array<Project>;
  let sections = [] as Array<Section>;

  /**
   * Recreate arrays and objects on updates to keep repository state isolated.
   *
   * @param {Array<Task>} nextTasks
   */
  const replace = (nextTasks: Array<Task>) => {
    tasks = nextTasks.map((task) => ({ ...task }));
  };
  /**
   * A section is valid only when it belongs to the same project as the task.
   *
   * @param {string | null} projectId
   * @param {string | null} sectionId
   * @returns {boolean}
   */
  const hasValidTaskPlacement = (projectId: string | null, sectionId: string | null): boolean =>
    sectionId === null || sections.find((section) => section.id === sectionId)?.projectId === projectId;

  return {
    /** Read methods return only data owned by this repository instance. */
    list: async () => tasks,
    /** Lists all projects owned by this repository instance. */
    listProjects: async () => projects,
    /** Creates a top-level project and appends it after its current siblings. */
    createProject: async (title) => {
      const createdAt = now();
      const siblings = projects
        .filter((project) => project.parentId === null)
        .toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const project = {
        id: crypto.randomUUID(),
        title,
        description: "",
        archived: false,
        parentId: null,
        lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        createdAt,
        updatedAt: createdAt,
      };

      projects = [...projects, project];

      return project;
    },
    /** Creates a nested project under an existing parent. */
    createSubproject: async (title, parentId) => {
      /** A subproject cannot be created when its parent does not exist. */
      if (!projects.some((project) => project.id === parentId)) throw new Error("Parent project not found");
      const createdAt = now();
      const siblings = projects
        .filter((item) => item.parentId === parentId)
        .toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const project = {
        id: crypto.randomUUID(),
        title,
        description: "",
        archived: false,
        parentId,
        lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        createdAt,
        updatedAt: createdAt,
      };
      projects = [...projects, project];
      return project;
    },
    /** Moves a project to a new parent or to the root level. */
    moveProject: async (id, parentId) => {
      /** Check the parent and its ancestors to prevent the move from creating a cycle. */
      const existing = projects.find((item) => item.id === id);
      if (
        !existing ||
        (parentId !== null && !projects.some((item) => item.id === parentId)) ||
        parentId === id
      )
        return null;
      let ancestor = parentId;
      while (ancestor !== null) {
        if (ancestor === id) return null;
        ancestor = projects.find((item) => item.id === ancestor)?.parentId ?? null;
      }
      const siblings = projects
        .filter((item) => item.parentId === parentId && item.id !== id)
        .toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const moved = {
        ...existing,
        parentId,
        lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        updatedAt: now(),
      };
      projects = projects.map((item) => (item.id === id ? moved : item));
      return moved;
    },
    /** Reorders a project among its siblings using the supplied neighbors. */
    reorderProject: async (id, beforeId, afterId) => {
      /** Consider only projects at the same level when computing the sort key. */
      const existing = projects.find((project) => project.id === id);
      if (!existing) return null;
      const ordered = projects
        .filter((project) => project.parentId === existing.parentId && project.id !== id)
        .toSorted((left, right) =>
          left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0,
        );
      const beforeIndex = beforeId === null ? -1 : ordered.findIndex((project) => project.id === beforeId);
      const afterIndex = afterId === null ? -1 : ordered.findIndex((project) => project.id === afterId);
      const low =
        afterIndex >= 0
          ? (ordered[afterIndex]?.lexicalOrder ?? null)
          : beforeId === null && afterId === null
            ? (ordered.at(-1)?.lexicalOrder ?? null)
            : null;
      const high = beforeIndex >= 0 ? (ordered[beforeIndex]?.lexicalOrder ?? null) : null;
      const reordered = {
        ...existing,
        lexicalOrder: generateLexicalOrder(low, high),
        updatedAt: now(),
      };
      projects = projects
        .map((project) => (project.id === id ? reordered : project))
        .toSorted((left, right) =>
          left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0,
        );
      return reordered;
    },
    /** Updates a project's supported fields and modification time. */
    updateProject: async (id, patch) => {
      /** A missing project cannot be updated. */
      const existing = projects.find((project) => project.id === id);

      if (existing === undefined) {
        return null;
      }

      const updated = {
        ...existing,
        ...patch,
        updatedAt: now(),
      };

      projects = projects.map((project) => (project.id === id ? updated : project));

      return updated;
    },
    /** Deletes a project and the project data contained within it. */
    deleteProject: async (id) => {
      /** Before deletion, collect project tasks and section tasks with all their descendants. */
      const existing = projects.find((project) => project.id === id);

      if (existing === undefined) {
        return false;
      }

      const projectSectionIds = new Set(
        sections.filter((section) => section.projectId === id).map((section) => section.id),
      );
      const doomedRootIds = tasks
        .filter(
          (task) =>
            task.projectId === id || (task.sectionId !== null && projectSectionIds.has(task.sectionId)),
        )
        .map((task) => task.id);
      const doomedIds = new Set(doomedRootIds.flatMap((taskId) => collectDescendantIds(tasks, taskId)));

      replace(tasks.filter((task) => !doomedIds.has(task.id)));
      sections = sections.filter((section) => section.projectId !== id);
      projects = projects
        .filter((project) => project.id !== id)
        .map((project) =>
          project.parentId === id ? { ...project, parentId: existing.parentId, updatedAt: now() } : project,
        );

      return true;
    },
    /** Duplicates a project and remaps IDs for its copied contents. */
    duplicateProject: async (id) => {
      /** Give the copy new IDs and use lookup maps to preserve its internal references. */
      const source = projects.find((project) => project.id === id);
      if (source === undefined) return null;
      const createdAt = now();
      const siblingProjects = projects
        .filter((project) => project.parentId === source.parentId)
        .toSorted((left, right) => left.lexicalOrder.localeCompare(right.lexicalOrder));
      const duplicated = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} copy`,
        archived: false,
        lexicalOrder: generateLexicalOrder(
          source.lexicalOrder,
          siblingProjects.find((project) => project.lexicalOrder > source.lexicalOrder)?.lexicalOrder ?? null,
        ),
        createdAt,
        updatedAt: createdAt,
      };
      const sourceSections = sections.filter((section) => section.projectId === id);
      const sectionMap = new Map(sourceSections.map((section) => [section.id, crypto.randomUUID()]));
      const newSections = sourceSections.map((section) => ({
        ...section,
        id: sectionMap.get(section.id)!,
        projectId: duplicated.id,
        createdAt,
        updatedAt: createdAt,
      }));
      const sourceTasks = tasks.filter((task) => task.projectId === id);
      const taskMap = new Map(sourceTasks.map((task) => [task.id, crypto.randomUUID()]));
      const newTasks = sourceTasks.map((task) => ({
        ...task,
        id: taskMap.get(task.id)!,
        projectId: duplicated.id,
        sectionId: task.sectionId === null ? null : (sectionMap.get(task.sectionId) ?? null),
        parentId: task.parentId === null ? null : (taskMap.get(task.parentId) ?? null),
        createdAt,
        updatedAt: createdAt,
      }));
      projects = [...projects, duplicated];
      sections = [...sections, ...newSections];
      replace([...tasks, ...newTasks]);
      return duplicated;
    },
    /** Updates whether a project is archived. */
    setProjectArchived: async (id, archived) => {
      /** Update the archive flag without changing the project contents. */
      const existing = projects.find((project) => project.id === id);
      if (existing === undefined) return null;
      const updated = { ...existing, archived, updatedAt: now() };
      projects = projects.map((project) => (project.id === id ? updated : project));
      return updated;
    },
    /** Lists all sections owned by this repository instance. */
    listSections: async () => sections,
    /** Reorders a section among sections in the same project. */
    reorderSection: async (id, beforeId, afterId) => {
      /** Reordering is limited to sections in the same project. */
      const section = sections.find((item) => item.id === id);
      if (!section) return null;
      const siblings = sections
        .filter((item) => item.projectId === section.projectId && item.id !== id)
        .toSorted((left, right) =>
          left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0,
        );
      const beforeIndex = beforeId === null ? -1 : siblings.findIndex((item) => item.id === beforeId);
      const afterIndex = afterId === null ? -1 : siblings.findIndex((item) => item.id === afterId);
      const low =
        afterIndex >= 0
          ? (siblings[afterIndex]?.lexicalOrder ?? null)
          : beforeId === null && afterId === null
            ? (siblings.at(-1)?.lexicalOrder ?? null)
            : null;
      const high = beforeIndex >= 0 ? (siblings[beforeIndex]?.lexicalOrder ?? null) : null;
      const reordered = {
        ...section,
        lexicalOrder: generateLexicalOrder(low, high),
        updatedAt: now(),
      };
      sections = sections
        .map((item) => (item.id === id ? reordered : item))
        .toSorted((left, right) =>
          left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0,
        );
      return reordered;
    },
    /** Creates a section in the Inbox or the specified project. */
    createSection: async (title, projectId) => {
      /** Give the new section a key after the project's last section. */
      const createdAt = now();
      const siblings = sections.filter((section) => section.projectId === projectId);
      const section = {
        id: crypto.randomUUID(),
        title,
        projectId,
        lexicalOrder: generateLexicalOrder(siblings.at(-1)?.lexicalOrder ?? null, null),
        createdAt,
        updatedAt: createdAt,
      };

      sections = [...sections, section];

      return section;
    },
    /** Renames an existing section. */
    updateSection: async (id, title) => {
      /** Preserve the other section fields and update only its title and modification time. */
      const existing = sections.find((section) => section.id === id);

      if (existing === undefined) {
        return null;
      }

      const updated = {
        ...existing,
        title,
        updatedAt: now(),
      };

      sections = sections.map((section) => (section.id === id ? updated : section));

      return updated;
    },
    /** Deletes a section and moves its tasks to the project root. */
    deleteSection: async (id) => {
      const existing = sections.find((section) => section.id === id);

      if (existing === undefined) {
        return false;
      }

      sections = sections.filter((section) => section.id !== id);
      replace(
        tasks.map((task) =>
          task.sectionId === id ? { ...task, parentId: null, sectionId: null, updatedAt: now() } : task,
        ),
      );

      return true;
    },
    /** Creates a task at the requested project, section, and parent placement. */
    create: async (title, parentId, projectId, sectionId) => {
      /** Before creation, check that the selected section matches the task's project. */
      if (!hasValidTaskPlacement(projectId, sectionId)) throw new Error("Section does not belong to project");
      const createdAt = now();
      const task = {
        id: crypto.randomUUID(),
        title,
        description: "",
        dueDate: null,
        labels: [],
        comments: [],
        completed: false,
        parentId,
        projectId,
        sectionId,
        lexicalOrder: findSiblingOrder(tasks, parentId, projectId, sectionId, null, null),
        createdAt,
        updatedAt: createdAt,
      };

      replace([...tasks, task]);

      return task;
    },
    /** Applies a partial update to an existing task. */
    patch: async (id, patch) => {
      /** For a partial update, preserve the original task and carry over unchanged fields. */
      const existing = tasks.find((task) => task.id === id);

      if (existing === undefined) {
        return null;
      }
      if (
        !hasValidTaskPlacement(
          patch.projectId === undefined ? existing.projectId : patch.projectId,
          patch.sectionId === undefined ? existing.sectionId : patch.sectionId,
        )
      )
        return null;

      const updated = {
        ...existing,
        ...patch,
        /** Keep IDs and timestamps for existing comments; the server assigns them to new comments. */
        comments:
          patch.comments === undefined
            ? existing.comments
            : patch.comments.map((comment) => {
                const previous = existing.comments.find((item) => item.id === comment.id);
                return {
                  id: previous?.id ?? crypto.randomUUID(),
                  body: comment.body,
                  createdAt: previous?.createdAt ?? now(),
                  ...(comment.attachments === undefined
                    ? previous?.attachments === undefined
                      ? {}
                      : { attachments: previous.attachments }
                    : { attachments: [...comment.attachments] }),
                };
              }),
        updatedAt: now(),
      };

      replace(tasks.map((task) => (task.id === id ? updated : task)));

      return updated;
    },
    /** Adds a comment to an existing task. */
    addComment: async (id, comment) => {
      /** Add the comment to the task and update the task timestamp. */
      const existing = tasks.find((task) => task.id === id);
      if (existing === undefined) return false;
      const updated = {
        ...existing,
        comments: [...existing.comments, comment],
        updatedAt: now(),
      };
      replace(tasks.map((task) => (task.id === id ? updated : task)));
      return true;
    },
    /** Moves a task to the requested placement and sibling order. */
    move: async (id, move) => {
      /** Reject missing parents, cycles, and mismatched project and section assignments. */
      const existing = tasks.find((task) => task.id === id);

      if (existing === undefined) {
        return null;
      }
      if (move.parentId !== null && !tasks.some((task) => task.id === move.parentId)) return null;

      if (wouldCreateTaskCycle(tasks, id, move.parentId)) return null;
      if (!hasValidTaskPlacement(move.projectId, move.sectionId)) return null;

      const updated = {
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
          move.afterId,
        ),
        updatedAt: now(),
      };

      replace(tasks.map((task) => (task.id === id ? updated : task)));

      return updated;
    },
    /** Deletes a task and all of its descendants. */
    delete: async (id) => {
      /** Deleting a root task also deletes its entire subtree. */
      const existing = tasks.find((task) => task.id === id);

      if (existing === undefined) {
        return false;
      }

      const deletedIds = new Set(collectDescendantIds(tasks, id));

      replace(tasks.filter((task) => !deletedIds.has(task.id)));

      return true;
    },
  };
};
