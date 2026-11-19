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
 * Table of accounts that own tasks and application settings.
 *
 * @typedef {Object} UsersTable
 * @property {string} id - User UUID used to associate application data and sessions.
 * @property {string} username - Unique login name; the index below enforces case-insensitive uniqueness.
 * @property {string} passwordHash - Password hash; the plaintext password is never stored.
 * @property {string} isAdmin - Permission to manage other accounts.
 * @property {string} confirmDelete - Whether to ask for confirmation before deleting.
 * @property {string} inboxDescription - Description of the Inbox.
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
    /** Prevents duplicate usernames that differ only by letter case. */
    uniqueIndex("users_username_lower_unique").on(sql`lower(${table.username})`),
  ],
);

/**
 * Table of active sessions; only the hash of the token issued to the client is stored.
 *
 * @typedef {Object} SessionsTable
 * @property {string} tokenHash - SHA-256 hash used to look up a session without storing the secret token.
 * @property {string} userId - User who owns the session.
 * @property {string} expiresAt - Session expiration time, after which the token is no longer accepted.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),

    userId: uuid("user_id").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    /** Speeds up lookups of a user’s sessions. */
    index("sessions_user_id_idx").on(table.userId),
    /** Supports deletion and cleanup of expired sessions. */
    index("sessions_expires_at_idx").on(table.expiresAt),
    /** Deletes sessions automatically when their account is deleted. */
    foreignKey({
      name: "sessions_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Table of user projects, including hierarchy and archive state.
 *
 * @typedef {Object} ProjectsTable
 * @property {string} id - Project identifier.
 * @property {string} userId - Project owner; project queries are scoped to this UUID.
 * @property {string} title - Project name.
 * @property {string} description - Project description, empty by default.
 * @property {string} archived - Whether the project is archived.
 * @property {string} parentId - Parent project for nested projects.
 * @property {string} lexicalOrder - Fractional sort key among neighboring projects.
 * @property {string} createdAt - Record creation time.
 * @property {string} updatedAt - Time when the record was last updated.
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
    /** Used by composite foreign keys to validate project ownership. */
    uniqueIndex("projects_id_user_id_uq").on(table.id, table.userId),
    /** Finds a user’s child projects. */
    index("projects_user_parent_idx").on(table.userId, table.parentId),
    /** Supports project reference checks that include the owner. */
    index("projects_parent_user_idx").on(table.parentId, table.userId),
    /** Deletes a user’s projects when their account is deleted. */
    foreignKey({
      name: "projects_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Prevents nesting a project under another user’s project. */
    foreignKey({
      name: "projects_parent_user_fk",
      columns: [table.parentId, table.userId],
      foreignColumns: [table.id, table.userId],
    }),
  ],
);

/**
 * Table of sections grouped within a user’s projects.
 *
 * @typedef {Object} SectionsTable
 * @property {string} id - Section identifier.
 * @property {string} userId - Section owner, used for access checks.
 * @property {string} title - Section title.
 * @property {string} projectId - Section project, or `NULL` for an Inbox section.
 * @property {string} lexicalOrder - Fractional sort key for sections within a project.
 * @property {string} createdAt - Section creation time.
 * @property {string} updatedAt - Time when the section was last updated.
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
    /** Enforces referential integrity for composite relationships by ID and owner. */
    uniqueIndex("sections_id_user_id_uq").on(table.id, table.userId),
    /** Speeds up queries for a user’s sections in a selected project. */
    index("sections_user_project_idx").on(table.userId, table.projectId),
    /** Index used by section foreign key checks. */
    index("sections_project_user_idx").on(table.projectId, table.userId),
    /** Deletes sections when their user is deleted. */
    foreignKey({
      name: "sections_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Ensures the section’s project belongs to the same user. */
    foreignKey({
      name: "sections_project_user_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }),
  ],
);

/**
 * Table of tasks with hierarchy, placement, and lexical ordering.
 *
 * @typedef {Object} TasksTable
 * @property {string} id - Task identifier.
 * @property {string} userId - Task owner, which scopes its visibility to one account.
 * @property {string} title - Short task title.
 * @property {string} description - Detailed task description.
 * @property {string} dueDate - Task due date stored as SQL DATE and exposed to the application as a string.
 * @property {string} labels - Task labels stored as a PostgreSQL text array.
 * @property {string} completed - Whether the task is complete.
 * @property {string} parentId - Parent task, or `NULL` for a top-level task.
 * @property {string} projectId - Task project, or `NULL` for the Inbox.
 * @property {string} sectionId - Task section, or `NULL` for the project root.
 * @property {string} lexicalOrder - String sort key among tasks in the same list and under the same parent.
 * @property {string} createdAt - Task creation time.
 * @property {string} updatedAt - Time when the task was last updated.
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
    /** Allows composite foreign keys to validate the task ID and owner. */
    uniqueIndex("tasks_id_user_id_uq").on(table.id, table.userId),
    /** Speeds up traversal of a user’s task tree. */
    index("tasks_user_parent_idx").on(table.userId, table.parentId),
    /** Supports task queries by project and owner. */
    index("tasks_user_project_idx").on(table.userId, table.projectId),
    /** Supports task queries by section and owner. */
    index("tasks_user_section_idx").on(table.userId, table.sectionId),
    /** Supports parent task foreign key checks. */
    index("tasks_parent_user_idx").on(table.parentId, table.userId),
    /** Supports project foreign key checks. */
    index("tasks_project_user_idx").on(table.projectId, table.userId),
    /** Supports section foreign key checks. */
    index("tasks_section_user_idx").on(table.sectionId, table.userId),
    /** Supports ordered queries for neighboring tasks in the same list. */
    index("tasks_user_parent_project_section_order_idx").on(
      table.userId,
      table.parentId,
      table.projectId,
      table.sectionId,
      table.lexicalOrder,
    ),
    /** Deletes a user’s tasks when their account is deleted. */
    foreignKey({
      name: "tasks_user_id_users_id_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Prevents a task from having a parent owned by another account. */
    foreignKey({
      name: "tasks_parent_user_fk",
      columns: [table.parentId, table.userId],
      foreignColumns: [table.id, table.userId],
    }),
    /** Prevents placing a task in another user’s project. */
    foreignKey({
      name: "tasks_project_user_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }),
    /** Prevents placing a task in another user’s section. */
    foreignKey({
      name: "tasks_section_user_fk",
      columns: [table.sectionId, table.userId],
      foreignColumns: [sections.id, sections.userId],
    }),
  ],
);

/**
 * Table of comments owned by the same user as their task.
 *
 * @typedef {Object} TaskCommentsTable
 * @property {string} id - Comment identifier.
 * @property {string} taskId - Task discussion to which the comment belongs.
 * @property {string} userId - Comment owner; a composite foreign key ties it to the task owner.
 * @property {string} body - Message text.
 * @property {string} createdAt - Comment creation time.
 * @property {string} attachments - JSON array of attached file metadata.
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
    /** Selects task comments in a stable chronological order. */
    index("task_comments_task_user_created_idx").on(table.taskId, table.userId, table.createdAt, table.id),
    /** Speeds up finding all comments for account data cleanup. */
    index("task_comments_user_id_idx").on(table.userId),
    /** Cascades comment deletion when the same user’s task is deleted. */
    foreignKey({
      name: "task_comments_task_user_fk",
      columns: [table.taskId, table.userId],
      foreignColumns: [tasks.id, tasks.userId],
    }).onDelete("cascade"),
    /** Deletes a user’s comments when their account is deleted. */
    foreignKey({
      name: "task_comments_user_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    /** Ensures attachment metadata is always represented as a JSON array. */
    check("task_comments_attachments_array_check", sql`jsonb_typeof(${table.attachments}) = 'array'`),
  ],
);
