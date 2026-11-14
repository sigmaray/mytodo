/**
 * Строковый идентификатор задачи, используемый в ссылках между задачами.
 *
 * @typedef {string} TaskId
 */
export type TaskId = string;
/**
 * Строковый идентификатор проекта, к которому можно привязать задачи и секции.
 *
 * @typedef {string} ProjectId
 */
export type ProjectId = string;
/**
 * Строковый идентификатор секции внутри проекта.
 *
 * @typedef {string} SectionId
 */
export type SectionId = string;

/**
 * Полная запись задачи, общая для доменной логики и приложений.
 *
 * @typedef {Object} Task
 * @property {TaskId} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} title - Данные «заголовок», используемые типом «Task».
 * @property {string} description - Данные «описание», используемые типом «Task».
 * @property {string | null} dueDate - Данные «due дата», используемые типом «Task».
 * @property {Array<string>} labels - Список метки.
 * @property {Array<Comment>} comments - Список комментарии.
 * @property {boolean} completed - Признак или настройка «completed».
 * @property {TaskId | null} parentId - Данные «родитель id», используемые типом «Task».
 * @property {ProjectId | null} projectId - Данные «проект id», используемые типом «Task».
 * @property {SectionId | null} sectionId - Данные «секция id», используемые типом «Task».
 * @property {string} lexicalOrder - Данные «lexical порядок», используемые типом «Task».
 * @property {string} createdAt - Данные «created в», используемые типом «Task».
 * @property {string} updatedAt - Данные «updated в», используемые типом «Task».
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
 * Метаданные файла, прикреплённого к комментарию.
 *
 * @typedef {Object} Attachment
 * @property {string} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} name - Данные «name», используемые типом «Attachment».
 * @property {string} mimeType - Данные «mime type», используемые типом «Attachment».
 * @property {number} size - Данные «size», используемые типом «Attachment».
 */
export type Attachment = {
  id: string;

  name: string;

  mimeType: string;

  size: number;
};
/**
 * Сообщение в обсуждении задачи и связанные с ним вложения.
 *
 * @typedef {Object} Comment
 * @property {string} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} body - Данные «body», используемые типом «Comment».
 * @property {string} createdAt - Данные «created в», используемые типом «Comment».
 * @property {Array<Attachment>} [attachments] - Список вложения.
 */
export type Comment = {
  id: string;

  body: string;

  createdAt: string;

  attachments?: Array<Attachment>;
};

/**
 * Задача, дополненная уже построенным списком дочерних узлов.
 *
 * @typedef {Object} TaskNode
 * @property {Array<TaskNode>} children - Дочерние задачи в порядке сортировки.
 */
export type TaskNode = Task & {
  children: Array<TaskNode>;
};

/**
 * Проект — область для организации задач и секций.
 *
 * @typedef {Object} Project
 * @property {ProjectId} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} title - Данные «заголовок», используемые типом «Project».
 * @property {string} description - Данные «описание», используемые типом «Project».
 * @property {boolean} archived - Признак, что проект помещён в архив.
 * @property {ProjectId | null} parentId - Данные «родитель id», используемые типом «Project».
 * @property {string} lexicalOrder - Данные «lexical порядок», используемые типом «Project».
 * @property {string} createdAt - Данные «created в», используемые типом «Project».
 * @property {string} updatedAt - Данные «updated в», используемые типом «Project».
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
 * Секция группирует задачи внутри проекта.
 *
 * @typedef {Object} Section
 * @property {SectionId} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} title - Данные «заголовок», используемые типом «Section».
 * @property {ProjectId | null} projectId - Данные «проект id», используемые типом «Section».
 * @property {string} lexicalOrder - Данные «lexical порядок», используемые типом «Section».
 * @property {string} createdAt - Данные «created в», используемые типом «Section».
 * @property {string} updatedAt - Данные «updated в», используемые типом «Section».
 */
export type Section = {
  id: SectionId;

  title: string;

  projectId: ProjectId | null;

  lexicalOrder: string;

  createdAt: string;

  updatedAt: string;
};
