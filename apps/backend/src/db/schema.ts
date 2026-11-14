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

/** Таблица учётных записей, владеющих задачами и настройками приложения. */
export const users = pgTable(
  "users",
  {
    /** UUID пользователя служит ключом для данных и сессий. */
    id: uuid("id").primaryKey(),
    /** Уникальное имя для входа; регистронезависимая уникальность закреплена индексом ниже. */
    username: text("username").notNull().unique(),
    /** Хеш пароля; NULL разрешён только до настройки первого пароля. */
    passwordHash: text("password_hash"),
    /** Разрешение управлять другими учётными записями. */
    isAdmin: boolean("is_admin").notNull().default(false),
    /** Настройка подтверждения разрушительных действий. */
    confirmDelete: boolean("confirm_delete").notNull().default(true),
    /** Описание личного списка задач Входящие. */
    inboxDescription: text("inbox_description").notNull().default(""),
  },
  (table) => [
    /** Запрещает дубликаты имён, различающиеся только регистром. */
    uniqueIndex("users_username_lower_unique").on(sql`lower(${table.username})`),
  ],
);

/** Таблица активных сессий; хранится только хеш выданного клиенту токена. */
export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 токена, используемый для поиска сессии без хранения секрета. */
    tokenHash: text("token_hash").primaryKey(),
    /** Пользователь, которому принадлежит сессия. */
    userId: uuid("user_id").notNull(),
    /** Время истечения сессии, после которого токен больше не принимается. */
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

/** Таблица проектов пользователя с поддержкой иерархии и архива. */
export const projects = pgTable(
  "projects",
  {
    /** Идентификатор проекта. */
    id: text("id").primaryKey(),
    /** Владелец проекта; все запросы к проектам ограничиваются этим UUID. */
    userId: uuid("user_id").notNull(),
    /** Название проекта. */
    title: text("title").notNull(),
    /** Описание проекта, по умолчанию пустое. */
    description: text("description").notNull().default(""),
    /** Признак скрытия проекта из активного списка. */
    archived: boolean("archived").notNull().default(false),
    /** Родительский проект для вложенных проектов. */
    parentId: text("parent_id"),
    /** Дробный ключ сортировки среди соседних проектов. */
    lexicalOrder: text("lexical_order").notNull(),
    /** Время создания записи. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Время последнего изменения записи. */
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

/** Таблица секций, сгруппированных внутри проектов одного пользователя. */
export const sections = pgTable(
  "sections",
  {
    /** Идентификатор секции. */
    id: text("id").primaryKey(),
    /** Владелец секции, используемый для проверки доступа. */
    userId: uuid("user_id").notNull(),
    /** Заголовок секции. */
    title: text("title").notNull(),
    /** Проект секции или NULL для секции во Входящих. */
    projectId: text("project_id"),
    /** Дробный ключ порядка секций внутри проекта. */
    lexicalOrder: text("lexical_order").notNull(),
    /** Время создания секции. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Время последнего изменения секции. */
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

/** Таблица задач с иерархией, размещением и лексикографическим порядком. */
export const tasks = pgTable(
  "tasks",
  {
    /** Идентификатор задачи. */
    id: text("id").primaryKey(),
    /** Владелец задачи, ограничивающий её видимость одним аккаунтом. */
    userId: uuid("user_id").notNull(),
    /** Краткое название задачи. */
    title: text("title").notNull(),
    /** Подробное описание задачи. */
    description: text("description").notNull().default(""),
    /** Срок задачи в SQL DATE, передаваемый приложению как строка. */
    dueDate: date("due_date", { mode: "string" }),
    /** Метки задачи, хранящиеся в PostgreSQL-массиве строк. */
    labels: text("labels").array().notNull().default([]),
    /** Признак завершения задачи. */
    completed: boolean("completed").notNull().default(false),
    /** Родительская задача либо NULL для корневой задачи. */
    parentId: text("parent_id"),
    /** Проект задачи либо NULL для Входящих. */
    projectId: text("project_id"),
    /** Секция задачи либо NULL для корня проекта. */
    sectionId: text("section_id"),
    /** Строковый ключ порядка среди задач того же списка и родителя. */
    lexicalOrder: text("lexical_order").notNull(),
    /** Время создания задачи. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Время последнего изменения задачи. */
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

/** Таблица комментариев, принадлежащих задаче и тому же пользователю. */
export const taskComments = pgTable(
  "task_comments",
  {
    /** Идентификатор комментария. */
    id: text("id").primaryKey(),
    /** Задача, к обсуждению которой относится комментарий. */
    taskId: text("task_id").notNull(),
    /** Владелец комментария; составной FK связывает его с владельцем задачи. */
    userId: uuid("user_id").notNull(),
    /** Текст сообщения. */
    body: text("body").notNull(),
    /** Время создания комментария. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    /** JSON-массив метаданных прикреплённых файлов. */
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
