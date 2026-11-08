import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  isAdmin: boolean("is_admin").notNull().default(false),
  confirmDelete: boolean("confirm_delete").notNull().default(true),
  inboxDescription: text("inbox_description").notNull().default(""),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    parentId: text("parent_id"),
    lexicalOrder: text("lexical_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_id_user_id_uq").on(table.id, table.userId),
    index("projects_user_parent_idx").on(table.userId, table.parentId),
    foreignKey({
      name: "projects_parent_user_fk",
      columns: [table.parentId, table.userId],
      foreignColumns: [table.id, table.userId],
    }),
  ],
);

export const sections = pgTable(
  "sections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    projectId: text("project_id"),
    lexicalOrder: text("lexical_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sections_id_user_id_uq").on(table.id, table.userId),
    index("sections_user_project_idx").on(table.userId, table.projectId),
    foreignKey({
      name: "sections_project_user_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    dueDate: text("due_date"),
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
    uniqueIndex("tasks_id_user_id_uq").on(table.id, table.userId),
    index("tasks_user_parent_idx").on(table.userId, table.parentId),
    index("tasks_user_project_idx").on(table.userId, table.projectId),
    index("tasks_user_section_idx").on(table.userId, table.sectionId),
    foreignKey({
      name: "tasks_parent_user_fk",
      columns: [table.parentId, table.userId],
      foreignColumns: [table.id, table.userId],
    }),
    foreignKey({
      name: "tasks_project_user_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }),
    foreignKey({
      name: "tasks_section_user_fk",
      columns: [table.sectionId, table.userId],
      foreignColumns: [sections.id, sections.userId],
    }),
  ],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    userId: text("user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    attachments: jsonb("attachments").notNull().default([]),
  },
  (table) => [
    index("task_comments_task_user_created_idx").on(table.taskId, table.userId, table.createdAt, table.id),
    foreignKey({
      name: "task_comments_task_user_fk",
      columns: [table.taskId, table.userId],
      foreignColumns: [tasks.id, tasks.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "task_comments_user_fk",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);
