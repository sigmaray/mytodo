import type { Comment, Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";

/** Набор изменений комментария при обновлении задачи. */
export type TaskCommentPatch = {
  /** Идентификатор сохранённого комментария; новые комментарии передаются без него. */
  id?: string;
  /** Текст нового или изменённого комментария. */
  body: string;
  /** Файлы, приложенные к комментарию, если клиент передал это поле. */
  attachments?: Comment["attachments"];
};

/** Поля задачи, которые разрешено менять частичным обновлением. */
export type TaskPatch = {
  /** Новое название задачи. */
  title?: string;
  /** Новое описание задачи. */
  description?: string;
  /** Новый срок или `null` для удаления срока. */
  dueDate?: string | null;
  /** Новый набор меток задачи. */
  labels?: Array<string>;
  /** Полный список комментариев после редактирования. */
  comments?: Array<TaskCommentPatch>;
  /** Новое состояние выполнения задачи. */
  completed?: boolean;
  /** Новый проект или `null` для Входящих. */
  projectId?: ProjectId | null;
  /** Новая секция или `null` для корневого списка проекта. */
  sectionId?: SectionId | null;
};

/** Целевое место задачи и соседи, между которыми нужно её поставить. */
export type TaskMove = {
  /** Новый родитель или `null` для корневого уровня. */
  parentId: TaskId | null;
  /** Целевой проект или `null` для Входящих. */
  projectId: ProjectId | null;
  /** Целевая секция или `null` для корня проекта. */
  sectionId: SectionId | null;
  /** Сосед, перед которым следует поставить задачу. */
  beforeId: TaskId | null;
  /** Сосед, после которого следует поставить задачу. */
  afterId: TaskId | null;
};

/** Контракт хранилища задач, проектов и секций для серверных маршрутов. */
export type TaskRepository = {
  /** Возвращает все задачи пользователя, которому принадлежит репозиторий. */
  list: () => Promise<Array<Task>>;
  /** Возвращает все проекты пользователя. */
  listProjects: () => Promise<Array<Project>>;
  /** Создаёт проект верхнего уровня. */
  createProject: (title: string) => Promise<Project>;
  /** Создаёт вложенный проект с указанным родителем. */
  createSubproject: (title: string, parentId: ProjectId) => Promise<Project>;
  /** Меняет родителя проекта или переносит его в корень. */
  moveProject: (id: ProjectId, parentId: ProjectId | null) => Promise<Project | null>;
  /** Переставляет проект между соседями на том же уровне дерева. */
  reorderProject: (
    /** Перемещаемый проект. */
    id: ProjectId,
    /** Проект, перед которым поставить перемещаемый, либо `null`. */
    beforeId: ProjectId | null,
    /** Проект, после которого поставить перемещаемый, либо `null`. */
    afterId: ProjectId | null,
  ) => Promise<Project | null>;
  /** Изменяет название и/или описание проекта. */
  updateProject: (
    /** Идентификатор проекта. */
    id: ProjectId,
    /** Новые значения полей проекта. */
    patch: {
      /** Новое название проекта. */
      title?: string;
      /** Новое описание проекта. */
      description?: string;
    },
  ) => Promise<Project | null>;
  /** Удаляет проект и возвращает признак его наличия. */
  deleteProject: (id: ProjectId) => Promise<boolean>;
  /** Создаёт копию существующего проекта и его содержимого. */
  duplicateProject: (id: ProjectId) => Promise<Project | null>;
  /** Архивирует проект или возвращает его в активный список. */
  setProjectArchived: (id: ProjectId, archived: boolean) => Promise<Project | null>;
  /** Возвращает все секции пользователя. */
  listSections: () => Promise<Array<Section>>;
  /** Переставляет секцию относительно соседних секций того же списка. */
  reorderSection: (
    /** Перемещаемая секция. */
    id: SectionId,
    /** Секция, перед которой поставить перемещаемую, либо `null`. */
    beforeId: SectionId | null,
    /** Секция, после которой поставить перемещаемую, либо `null`. */
    afterId: SectionId | null,
  ) => Promise<Section | null>;
  /** Создаёт секцию в проекте либо во Входящих. */
  createSection: (title: string, projectId: ProjectId | null) => Promise<Section>;
  /** Переименовывает секцию. */
  updateSection: (id: SectionId, title: string) => Promise<Section | null>;
  /** Удаляет секцию и возвращает признак её наличия. */
  deleteSection: (id: SectionId) => Promise<boolean>;
  /** Создаёт задачу в заданном родительском и проектном контексте. */
  create: (
    /** Название новой задачи. */
    title: string,
    /** Родительская задача или `null` для корневой. */
    parentId: TaskId | null,
    /** Проект назначения или `null` для Входящих. */
    projectId: ProjectId | null,
    /** Секция назначения или `null` для корня списка. */
    sectionId: SectionId | null,
  ) => Promise<Task>;
  /** Применяет частичное изменение к задаче. */
  patch: (id: TaskId, patch: TaskPatch) => Promise<Task | null>;
  /** Добавляет комментарий и сообщает, удалось ли найти задачу. */
  addComment: (id: TaskId, comment: Task["comments"][number]) => Promise<boolean>;
  /** Перемещает задачу и возвращает обновлённую запись. */
  move: (id: TaskId, move: TaskMove) => Promise<Task | null>;
  /** Удаляет задачу и возвращает признак её наличия. */
  delete: (id: TaskId) => Promise<boolean>;
};

/** Экспортирует in-memory репозиторий для разработки и тестовой среды. */
export { createMemoryTaskRepository } from "./memoryTaskRepository";
