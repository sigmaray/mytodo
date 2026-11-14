import type { Comment, Project, ProjectId, Section, SectionId, Task, TaskId } from "@todoist-clone/domain";

/**
 * Набор изменений комментария при обновлении задачи.
 *
 * @typedef {Object} TaskCommentPatch
 * @property {string} [id] - Идентификатор сущности, с которой работает модуль.
 * @property {string} body - Данные «body», используемые типом «TaskCommentPatch».
 * @property {Comment["attachments"]} [attachments] - Данные «вложения», используемые типом «TaskCommentPatch».
 */
export type TaskCommentPatch = {
  id?: string;

  body: string;

  attachments?: Comment["attachments"];
};

/**
 * Поля задачи, которые разрешено менять частичным обновлением.
 *
 * @typedef {Object} TaskPatch
 * @property {string} [title] - Данные «заголовок», используемые типом «TaskPatch».
 * @property {string} [description] - Данные «описание», используемые типом «TaskPatch».
 * @property {string | null} [dueDate] - Данные «due дата», используемые типом «TaskPatch».
 * @property {Array<string>} [labels] - Список метки.
 * @property {Array<TaskCommentPatch>} [comments] - Список комментарии.
 * @property {boolean} [completed] - Признак или настройка «completed».
 * @property {ProjectId | null} [projectId] - Данные «проект id», используемые типом «TaskPatch».
 * @property {SectionId | null} [sectionId] - Данные «секция id», используемые типом «TaskPatch».
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
 * Целевое место задачи и соседи, между которыми нужно её поставить.
 *
 * @typedef {Object} TaskMove
 * @property {TaskId | null} parentId - Данные «родитель id», используемые типом «TaskMove».
 * @property {ProjectId | null} projectId - Данные «проект id», используемые типом «TaskMove».
 * @property {SectionId | null} sectionId - Данные «секция id», используемые типом «TaskMove».
 * @property {TaskId | null} beforeId - Данные «предыдущего id», используемые типом «TaskMove».
 * @property {TaskId | null} afterId - Данные «следующего id», используемые типом «TaskMove».
 */
export type TaskMove = {
  parentId: TaskId | null;

  projectId: ProjectId | null;

  sectionId: SectionId | null;

  beforeId: TaskId | null;

  afterId: TaskId | null;
};

/**
 * Возвращает все задачи пользователя, которому принадлежит репозиторий.
 *
 * @callback TaskRepositoryList
 * @returns {Promise<Array<Task>>}
 */

/**
 * Возвращает все проекты пользователя.
 *
 * @callback TaskRepositoryListProjects
 * @returns {Promise<Array<Project>>}
 */

/**
 * Создаёт проект верхнего уровня.
 *
 * @callback TaskRepositoryCreateProject
 * @param {string} title
 * @returns {Promise<Project>}
 */

/**
 * Создаёт вложенный проект с указанным родителем.
 *
 * @callback TaskRepositoryCreateSubproject
 * @param {string} title
 * @param {ProjectId} parentId
 * @returns {Promise<Project>}
 */

/**
 * Меняет родителя проекта или переносит его в корень.
 *
 * @callback TaskRepositoryMoveProject
 * @param {ProjectId} id
 * @param {ProjectId | null} parentId
 * @returns {Promise<Project | null>}
 */

/**
 * Переставляет проект между соседями на том же уровне дерева.
 *
 * @callback TaskRepositoryReorderProject
 * @param {ProjectId} id
 * @param {ProjectId | null} beforeId
 * @param {ProjectId | null} afterId
 * @returns {Promise<Project | null>}
 */

/**
 * Изменяет название и/или описание проекта.
 *
 * @callback TaskRepositoryUpdateProject
 * @param {ProjectId} id
 * @param {{ title?: string; description?: string; }} patch
 * @param {string} patch.title - Новое название.
 * @param {string} patch.description - Новое описание.
 * @returns {Promise<Project | null>}
 */

/**
 * Удаляет проект и возвращает признак его наличия.
 *
 * @callback TaskRepositoryDeleteProject
 * @param {ProjectId} id
 * @returns {Promise<boolean>}
 */

/**
 * Создаёт копию существующего проекта и его содержимого.
 *
 * @callback TaskRepositoryDuplicateProject
 * @param {ProjectId} id
 * @returns {Promise<Project | null>}
 */

/**
 * Архивирует проект или возвращает его в активный список.
 *
 * @callback TaskRepositorySetProjectArchived
 * @param {ProjectId} id
 * @param {boolean} archived
 * @returns {Promise<Project | null>}
 */

/**
 * Возвращает все секции пользователя.
 *
 * @callback TaskRepositoryListSections
 * @returns {Promise<Array<Section>>}
 */

/**
 * Переставляет секцию относительно соседних секций того же списка.
 *
 * @callback TaskRepositoryReorderSection
 * @param {SectionId} id
 * @param {SectionId | null} beforeId
 * @param {SectionId | null} afterId
 * @returns {Promise<Section | null>}
 */

/**
 * Создаёт секцию в проекте либо во Входящих.
 *
 * @callback TaskRepositoryCreateSection
 * @param {string} title
 * @param {ProjectId | null} projectId
 * @returns {Promise<Section>}
 */

/**
 * Переименовывает секцию.
 *
 * @callback TaskRepositoryUpdateSection
 * @param {SectionId} id
 * @param {string} title
 * @returns {Promise<Section | null>}
 */

/**
 * Удаляет секцию и возвращает признак её наличия.
 *
 * @callback TaskRepositoryDeleteSection
 * @param {SectionId} id
 * @returns {Promise<boolean>}
 */

/**
 * Создаёт задачу в заданном родительском и проектном контексте.
 *
 * @callback TaskRepositoryCreate
 * @param {string} title
 * @param {TaskId | null} parentId
 * @param {ProjectId | null} projectId
 * @param {SectionId | null} sectionId
 * @returns {Promise<Task>}
 */

/**
 * Применяет частичное изменение к задаче.
 *
 * @callback TaskRepositoryPatch
 * @param {TaskId} id
 * @param {TaskPatch} patch
 * @returns {Promise<Task | null>}
 */

/**
 * Добавляет комментарий и сообщает, удалось ли найти задачу.
 *
 * @callback TaskRepositoryAddComment
 * @param {TaskId} id
 * @param {Task["comments"][number]} comment
 * @returns {Promise<boolean>}
 */

/**
 * Перемещает задачу и возвращает обновлённую запись.
 *
 * @callback TaskRepositoryMove
 * @param {TaskId} id
 * @param {TaskMove} move
 * @returns {Promise<Task | null>}
 */

/**
 * Удаляет задачу и возвращает признак её наличия.
 *
 * @callback TaskRepositoryDelete
 * @param {TaskId} id
 * @returns {Promise<boolean>}
 */
/**
 * Контракт хранилища задач, проектов и секций для серверных маршрутов.
 *
 * @typedef {Object} TaskRepository
 * @property {TaskRepositoryList} list - Возвращает задачи пользователя в порядке для построения дерева.
 * @property {TaskRepositoryListProjects} listProjects - Возвращает проекты пользователя.
 * @property {TaskRepositoryCreateProject} createProject - Создаёт проект верхнего уровня.
 * @property {TaskRepositoryCreateSubproject} createSubproject - Создаёт вложенный проект.
 * @property {TaskRepositoryMoveProject} moveProject - Меняет родителя проекта или переносит его в корень.
 * @property {TaskRepositoryReorderProject} reorderProject - Переставляет проект среди соседей.
 * @property {TaskRepositoryUpdateProject} updateProject - Обновляет название и описание проекта.
 * @property {TaskRepositoryDeleteProject} deleteProject - Удаляет проект.
 * @property {TaskRepositoryDuplicateProject} duplicateProject - Создаёт копию проекта вместе с содержимым.
 * @property {TaskRepositorySetProjectArchived} setProjectArchived - Архивирует проект или возвращает его в активный список.
 * @property {TaskRepositoryListSections} listSections - Возвращает секции пользователя.
 * @property {TaskRepositoryReorderSection} reorderSection - Переставляет секцию среди соседних секций.
 * @property {TaskRepositoryCreateSection} createSection - Создаёт секцию в проекте или во Входящих.
 * @property {TaskRepositoryUpdateSection} updateSection - Переименовывает секцию.
 * @property {TaskRepositoryDeleteSection} deleteSection - Удаляет секцию.
 * @property {TaskRepositoryCreate} create - Создаёт задачу в заданном контексте.
 * @property {TaskRepositoryPatch} patch - Применяет частичные изменения к задаче.
 * @property {TaskRepositoryAddComment} addComment - Добавляет комментарий к задаче.
 * @property {TaskRepositoryMove} move - Перемещает задачу в новое место дерева.
 * @property {TaskRepositoryDelete} delete - Удаляет задачу и возвращает признак её наличия.
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

/** Экспортирует in-memory репозиторий для разработки и тестовой среды. */
export { createMemoryTaskRepository } from "./memoryTaskRepository";
