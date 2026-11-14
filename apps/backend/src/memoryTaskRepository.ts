import type { Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";
import { generateLexicalOrder } from "@todoist-clone/domain";
import type { TaskRepository } from "./repository";

/** Возвращает текущее время в формате, принятом доменными моделями. */
const now = () => new Date().toISOString();

/** Собирает идентификатор задачи и всех потомков для каскадного удаления. */
const collectDescendantIds = (allTasks: Array<Task>, id: TaskId): Array<TaskId> => [
  id,
  ...allTasks
    .filter((task) => task.parentId === id)
    .flatMap((task) => collectDescendantIds(allTasks, task.id)),
];

/** Проверяет, создаст ли назначение родителя цикл в иерархии задач. */
const wouldCreateTaskCycle = (tasks: Array<Task>, taskId: TaskId, parentId: TaskId | null): boolean => {
  // Идём от предлагаемого родителя вверх и ищем саму задачу или уже посещённый узел.
  const followsParentChain = (ancestorId: TaskId | null, visited: Array<TaskId>): boolean => {
    if (ancestorId === null) return false;
    if (ancestorId === taskId || visited.includes(ancestorId)) return true;
    const parent = tasks.find((task) => task.id === ancestorId);
    return followsParentChain(parent?.parentId ?? null, [...visited, ancestorId]);
  };
  return followsParentChain(parentId, []);
};

/** Сравнивает задачи по строковому ключу ручной сортировки. */
const compareOrder = (left: Task, right: Task): number =>
  left.lexicalOrder < right.lexicalOrder ? -1 : left.lexicalOrder > right.lexicalOrder ? 1 : 0;

/** Вычисляет дробный ключ между соседями в заданном списке задач. */
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

/** Создаёт тестовое хранилище задач, проектов и секций без подключения к базе. */
export const createMemoryTaskRepository = (initialTasks: Array<Task> = []): TaskRepository => {
  // Копируем входные данные, чтобы репозиторий не изменял переданный массив.
  let tasks = initialTasks.map((task) => ({ ...task }));
  let projects = [] as Array<Project>;
  let sections = [] as Array<Section>;

  // Пересоздаём массив и объекты при изменении, сохраняя изоляцию состояния репозитория.
  const replace = (nextTasks: Array<Task>) => {
    tasks = nextTasks.map((task) => ({ ...task }));
  };
  // Секция допустима только внутри того же проекта, что указан у задачи.
  const hasValidTaskPlacement = (projectId: string | null, sectionId: string | null): boolean =>
    sectionId === null || sections.find((section) => section.id === sectionId)?.projectId === projectId;

  return {
    // Методы чтения возвращают только данные текущего экземпляра репозитория.
    list: async () => tasks,
    listProjects: async () => projects,
    createProject: async (title) => {
      // Новый проект добавляется в конец списка соседних корневых проектов.
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
    createSubproject: async (title, parentId) => {
      // Подпроект нельзя создать, если его родитель отсутствует.
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
    moveProject: async (id, parentId) => {
      // Проверяем родителя и всю его цепочку, чтобы перемещение не создало цикл.
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
    reorderProject: async (id, beforeId, afterId) => {
      // Для ключа порядка рассматриваются только проекты того же уровня.
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
    updateProject: async (id, patch) => {
      // Отсутствующий проект нельзя обновить.
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
    deleteProject: async (id) => {
      // Перед удалением собираем задачи проекта и задачи его секций вместе с потомками.
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
    duplicateProject: async (id) => {
      // Копия получает новые ID; таблицы соответствий сохраняют внутренние ссылки.
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
    setProjectArchived: async (id, archived) => {
      // Архивный признак меняется без изменения содержимого проекта.
      const existing = projects.find((project) => project.id === id);
      if (existing === undefined) return null;
      const updated = { ...existing, archived, updatedAt: now() };
      projects = projects.map((project) => (project.id === id ? updated : project));
      return updated;
    },
    listSections: async () => sections,
    reorderSection: async (id, beforeId, afterId) => {
      // Перестановка ограничена секциями того же проекта.
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
    createSection: async (title, projectId) => {
      // Новая секция получает ключ после последней секции проекта.
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
    updateSection: async (id, title) => {
      // Сохраняем остальные поля секции и обновляем только название и время изменения.
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
    deleteSection: async (id) => {
      // Задачи удалённой секции остаются в проекте, но возвращаются на корневой уровень.
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
    create: async (title, parentId, projectId, sectionId) => {
      // Перед созданием проверяем, что выбранная секция совпадает с проектом задачи.
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
    patch: async (id, patch) => {
      // Для частичного обновления сохраняем исходную задачу и наследуем её неизменённые поля.
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
        // Существующие комментарии сохраняют ID и дату; сервер назначает их новым сообщениям.
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
    addComment: async (id, comment) => {
      // Комментарий добавляется к задаче и одновременно обновляет время самой задачи.
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
    move: async (id, move) => {
      // Не допускаем отсутствующего родителя, цикла и несогласованного проекта с секцией.
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
    delete: async (id) => {
      // Удаление корневой задачи также удаляет всё её поддерево.
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
