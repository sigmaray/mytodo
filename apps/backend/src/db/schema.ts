import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Таблица учётных записей, владеющих задачами и настройками приложения.
 *
 * @typedef {Object} UsersTable
 * @property {string} id - UUID пользователя служит ключом для данных и сессий.
 * @property {string} username - Уникальное имя для входа; регистронезависимая уникальность закреплена индексом ниже.
 * @property {string} passwordHash - Хеш пароля; сам пароль не хранится.
 * @property {string} isAdmin - Разрешение управлять другими учётными записями.
 * @property {string} confirmDelete - Настройка подтверждения перед удалением.
 * @property {string} inboxDescription - Описание списка Входящие.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),

    username: text("username").notNull().unique(),

    passwordHash: text("password_hash"),

    isAdmin: boolean("is_admin").notNull().default(false),

    confirmDelete: boolean("confirm_delete").notNull().default(true),

    inboxDescription: text("inbox_description").notNull().default(""),
  },
  (table) => [
    /** Запрещает дубликаты имён, различающиеся только регистром. */
    uniqueIndex("users_username_lower_unique").on(sql`lower(${table.username})`),
  ],
);

/**
 * Таблица активных сессий; хранится только хеш выданного клиенту токена.
 *
 * @typedef {Object} SessionsTable
 * @property {string} tokenHash - SHA-256 токена, используемый для поиска сессии без хранения секрета.
 * @property {string} userId - Пользователь, которому принадлежит сессия.
 * @property {string} expiresAt - Время истечения сессии, после которого токен больше не принимается.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),

    userId: uuid("user_id").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    /** Ускоряет поиск сессий конкретного пользователя. */
    index("sessions_user_id_idx").on(table.userId),
    /** Помогает удалять или чистить истёкшие сессии. */
    index("sessions_expires_at_idx").on(table.expiresAt),
    /** Удаляет сессии автоматически вместе с учётной записью. */
    foreignKey({
      name: "sessions_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Таблица проектов пользователя с поддержкой иерархии и архива.
 *
 * @typedef {Object} ProjectsTable
 * @property {string} id - Идентификатор проекта.
 * @property {string} userId - Владелец проекта; все запросы к проектам ограничиваются этим UUID.
 * @property {string} title - Название проекта.
 * @property {string} description - Описание проекта, по умолчанию пустое.
 * @property {string} archived - Признак, что проект помещён в архив.
 * @property {string} parentId - Родительский проект для вложенных проектов.
 * @property {string} lexicalOrder - Дробный ключ сортировки среди соседних проектов.
 * @property {string} createdAt - Время создания записи.
 * @property {string} updatedAt - Время последнего изменения записи.
 */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),

    userId: uuid("user_id").notNull(),

    title: text("title").notNull(),

    description: text("description").notNull().default(""),

    archived: boolean("archived").notNull().default(false),

    parentId: text("parent_id"),

    lexicalOrder: text("lexical_order").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Нужен составным внешним ключам, которые проверяют владельца проекта. */
    uniqueIndex("projects_id_user_id_uq").on(table.id, table.userId),
    /** Находит дочерние проекты пользователя. */
    index("projects_user_parent_idx").on(table.userId, table.parentId),
    /** Поддерживает проверки ссылок на проект с учётом владельца. */
    index("projects_parent_user_idx").on(table.parentId, table.userId),
    /** Удаляет проекты пользователя вместе с его аккаунтом. */
    foreignKey({
      name: "projects_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Не позволяет вложить проект в родителя другого пользователя. */
    foreignKey({
      name: "projects_parent_user_fk",
      columns: [table.parentId, table.userId],
      foreignColumns: [table.id, table.userId],
    }),
  ],
);

/**
 * Таблица секций, сгруппированных внутри проектов одного пользователя.
 *
 * @typedef {Object} SectionsTable
 * @property {string} id - Идентификатор секции.
 * @property {string} userId - Владелец секции, используемый для проверки доступа.
 * @property {string} title - Заголовок секции.
 * @property {string} projectId - Проект секции или NULL для секции во Входящих.
 * @property {string} lexicalOrder - Дробный ключ порядка секций внутри проекта.
 * @property {string} createdAt - Время создания секции.
 * @property {string} updatedAt - Время последнего изменения секции.
 */
export const sections = pgTable(
  "sections",
  {
    id: text("id").primaryKey(),

    userId: uuid("user_id").notNull(),

    title: text("title").notNull(),

    projectId: text("project_id"),

    lexicalOrder: text("lexical_order").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Обеспечивает ссылочную целостность составных связей по ID и владельцу. */
    uniqueIndex("sections_id_user_id_uq").on(table.id, table.userId),
    /** Ускоряет получение секций пользователя в выбранном проекте. */
    index("sections_user_project_idx").on(table.userId, table.projectId),
    /** Индекс для проверок внешнего ключа на секцию. */
    index("sections_project_user_idx").on(table.projectId, table.userId),
    /** Удаляет секции вместе с их пользователем. */
    foreignKey({
      name: "sections_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Проверяет, что проект секции принадлежит тому же пользователю. */
    foreignKey({
      name: "sections_project_user_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }),
  ],
);

/**
 * Таблица задач с иерархией, размещением и лексикографическим порядком.
 *
 * @typedef {Object} TasksTable
 * @property {string} id - Идентификатор задачи.
 * @property {string} userId - Владелец задачи, ограничивающий её видимость одним аккаунтом.
 * @property {string} title - Краткое название задачи.
 * @property {string} description - Подробное описание задачи.
 * @property {string} dueDate - Срок задачи в SQL DATE, передаваемый приложению как строка.
 * @property {string} labels - Метки задачи, хранящиеся в PostgreSQL-массиве строк.
 * @property {string} completed - Признак завершения задачи.
 * @property {string} parentId - Родительская задача либо NULL для корневой задачи.
 * @property {string} projectId - Проект задачи либо NULL для Входящих.
 * @property {string} sectionId - Секция задачи либо NULL для корня проекта.
 * @property {string} lexicalOrder - Строковый ключ порядка среди задач того же списка и родителя.
 * @property {string} createdAt - Время создания задачи.
 * @property {string} updatedAt - Время последнего изменения задачи.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),

    userId: uuid("user_id").notNull(),

    title: text("title").notNull(),

    description: text("description").notNull().default(""),

    dueDate: date("due_date", { mode: "string" }),

    labels: text("labels").array().notNull().default([]),

    completed: boolean("completed").notNull().default(false),

    parentId: text("parent_id"),

    projectId: text("project_id"),

    sectionId: text("section_id"),

    lexicalOrder: text("lexical_order").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Даёт составным внешним ключам проверить ID задачи и её владельца. */
    uniqueIndex("tasks_id_user_id_uq").on(table.id, table.userId),
    /** Ускоряет обход дерева задач пользователя. */
    index("tasks_user_parent_idx").on(table.userId, table.parentId),
    /** Поддерживает выборки задач по проекту и владельцу. */
    index("tasks_user_project_idx").on(table.userId, table.projectId),
    /** Поддерживает выборки задач по секции и владельцу. */
    index("tasks_user_section_idx").on(table.userId, table.sectionId),
    /** Обслуживает проверки внешнего ключа родительской задачи. */
    index("tasks_parent_user_idx").on(table.parentId, table.userId),
    /** Обслуживает проверки внешнего ключа проекта. */
    index("tasks_project_user_idx").on(table.projectId, table.userId),
    /** Обслуживает проверки внешнего ключа секции. */
    index("tasks_section_user_idx").on(table.sectionId, table.userId),
    /** Поддерживает упорядоченную выборку соседей в том же списке. */
    index("tasks_user_parent_project_section_order_idx").on(
      table.userId,
      table.parentId,
      table.projectId,
      table.sectionId,
      table.lexicalOrder,
    ),
    /** Удаляет задачи пользователя при удалении аккаунта. */
    foreignKey({
      name: "tasks_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Не допускает родителя задачи из чужого аккаунта. */
    foreignKey({
      name: "tasks_parent_user_fk",
      columns: [table.parentId, table.userId],
      foreignColumns: [table.id, table.userId],
    }),
    /** Не допускает размещение задачи в чужом проекте. */
    foreignKey({
      name: "tasks_project_user_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }),
    /** Не допускает размещение задачи в чужой секции. */
    foreignKey({
      name: "tasks_section_user_fk",
      columns: [table.sectionId, table.userId],
      foreignColumns: [sections.id, sections.userId],
    }),
  ],
);

/**
 * Таблица комментариев, принадлежащих задаче и тому же пользователю.
 *
 * @typedef {Object} TaskCommentsTable
 * @property {string} id - Идентификатор комментария.
 * @property {string} taskId - Задача, к обсуждению которой относится комментарий.
 * @property {string} userId - Владелец комментария; составной FK связывает его с владельцем задачи.
 * @property {string} body - Текст сообщения.
 * @property {string} createdAt - Время создания комментария.
 * @property {string} attachments - JSON-массив метаданных прикреплённых файлов.
 */
export const taskComments = pgTable(
  "task_comments",
  {
    id: text("id").primaryKey(),

    taskId: text("task_id").notNull(),

    userId: uuid("user_id").notNull(),

    body: text("body").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),

    attachments: jsonb("attachments").notNull().default([]),
  },
  (table) => [
    /** Выбирает комментарии задачи в стабильном хронологическом порядке. */
    index("task_comments_task_user_created_idx").on(table.taskId, table.userId, table.createdAt, table.id),
    /** Ускоряет поиск всех комментариев аккаунта для очистки его данных. */
    index("task_comments_user_id_idx").on(table.userId),
    /** Каскадно удаляет комментарии вместе с задачей того же пользователя. */
    foreignKey({
      name: "task_comments_task_user_fk",
      columns: [table.taskId, table.userId],
      foreignColumns: [tasks.id, tasks.userId],
    }).onDelete("cascade"),
    /** Удаляет комментарии пользователя вместе с аккаунтом. */
    foreignKey({
      name: "task_comments_user_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Гарантирует, что метаданные вложений всегда представлены JSON-массивом. */
    check("task_comments_attachments_array_check", sql`jsonb_typeof(${table.attachments}) = 'array'`),
  ],
);
