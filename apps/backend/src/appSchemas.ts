import { z } from "zod";

/** Validates task creation data and supplies empty default context values.
 * @property {string} title - Required display title for the task.
 * @property {string | null} parentId - Parent task, or `null` to place the task at the tree root.
 * @property {string | null} projectId - Owning project, or `null` for the Inbox.
 * @property {string | null} sectionId - Owning section, or `null` for the project root.
 */
export const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  sectionId: z.string().nullable().default(null),
});

/** Validates project or subproject data before creation.
 * @property {string} title - Required project title.
 * @property {string | null} parentId - Parent project, or `null` for a top-level project.
 */
export const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
});
/** Validates a new section title and its project.
 * @property {string} title - Required section title.
 * @property {string | null} projectId - Owning project, or `null` for an Inbox section.
 */
export const createSectionSchema = z.object({
  title: z.string().trim().min(1),
  projectId: z.string().nullable().default(null),
});

/** Validates the username and password submitted at sign-in.
 * @property {string} username - Account name used to look up the signing-in user.
 * @property {string} password - Password submitted for authentication.
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1),
});

/** Validates user settings.
 * @property {boolean} confirmDelete - Whether destructive actions require confirmation.
 */
export const updateSettingsSchema = z.object({
  confirmDelete: z.boolean(),
});
/** Validates optional account changes and rejects a request with no changes.
 * @property {string} [username] - Replacement account name.
 * @property {string} [password] - Replacement password, which the server hashes before storing.
 */
export const updateAccountSchema = z
  .object({ username: z.string().trim().min(1).max(64).optional(), password: z.string().min(1).optional() })
  .refine((patch) => Object.keys(patch).length > 0);
/** Validates a new account created by an administrator.
 * @property {string} username - Account name for the new user.
 * @property {string} password - Initial password, hashed by the server before storage.
 * @property {boolean} isAdmin - Whether the account receives administrator privileges; defaults to false.
 */
export const createUserSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1),
  isAdmin: z.boolean().default(false),
});
/** Validates optional changes to an existing account and rejects an empty update.
 * @property {string} [username] - Replacement account name.
 * @property {string} [password] - Replacement password, hashed by the server before storage.
 * @property {boolean} [isAdmin] - Replacement administrator role.
 */
export const updateUserSchema = z
  .object({
    username: z.string().trim().min(1).max(64).optional(),
    password: z.string().min(1).optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0);
/** Validates the Inbox description and limits the amount of stored text.
 * @property {string} description - Descriptive text shown for the user's Inbox.
 */
export const inboxDescriptionSchema = z.object({
  description: z.string().max(20000),
});

/**
 * Reads a JSON request body, or returns an empty object for other content types.
 *
 * @param {Request} request
 * @returns The parsed JSON body or an empty object.
 */
export const parseJson = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};
