import { z } from "zod";

/** Validates task creation data and supplies empty default context values. */
export const createTaskSchema = z.object({
  /** New task title with surrounding whitespace removed. */
  title: z.string().trim().min(1),
  /** Parent task ID, or the default root value. */
  parentId: z.string().nullable().default(null),
  /** Project ID, or the Inbox by default. */
  projectId: z.string().nullable().default(null),
  /** Section ID, or the project root by default. */
  sectionId: z.string().nullable().default(null),
});

/** Validates project or subproject data before creation. */
export const createProjectSchema = z.object({
  /** Non-empty title for the new project. */
  title: z.string().trim().min(1),
  /** Parent project, or `null` for a top-level project. */
  parentId: z.string().nullable().default(null),
});
/** Validates a new section title and its project. */
export const createSectionSchema = z.object({
  /** Non-empty section title. */
  title: z.string().trim().min(1),
  /** Owning project, or the Inbox by default. */
  projectId: z.string().nullable().default(null),
});

/** Validates the username and password submitted at sign-in. */
export const loginSchema = z.object({
  /** Login name with surrounding whitespace removed. */
  username: z.string().trim().min(1).max(64),
  /** Plaintext password used to verify the stored hash. */
  password: z.string().min(1),
});

/** Validates user settings. */
export const updateSettingsSchema = z.object({
  /** Whether to ask for confirmation before deleting. */
  confirmDelete: z.boolean(),
});
/** Validates a username or password change and rejects an empty update. */
export const updateAccountSchema = z
  .object({ username: z.string().trim().min(1).max(64).optional(), password: z.string().min(1).optional() })
  /** Require at least one field so the request changes the account. */
  .refine((patch) => Object.keys(patch).length > 0);
/** Validates a new account created by an administrator. */
export const createUserSchema = z.object({
  /** Unique username for the new account. */
  username: z.string().trim().min(1).max(64),
  /** Plaintext password that the backend hashes before storing. */
  password: z.string().min(1),
  /** Whether to grant administrator privileges to the new account. */
  isAdmin: z.boolean().default(false),
});
/** Validates a set of changes to an existing account. */
export const updateUserSchema = z
  .object({
    /** New username, if it is changing. */
    username: z.string().trim().min(1).max(64).optional(),
    /** New password before server-side hashing. */
    password: z.string().min(1).optional(),
    /** New user role, if the administrator is changing it. */
    isAdmin: z.boolean().optional(),
  })
  /** Reject an empty PATCH so each accepted request changes at least one field. */
  .refine((patch) => Object.keys(patch).length > 0);
/** Validates the Inbox description and limits the amount of stored text. */
export const inboxDescriptionSchema = z.object({
  /** Description text, limited to 20,000 characters. */
  description: z.string().max(20000),
});

/**
 * Reads a JSON request body, or returns an empty object for other content types.
 *
 * @param {Request} request
 * @returns The parsed JSON body or an empty object.
 */
export const parseJson = async (request: Request) => {
  /** Routes may accept requests without a body, so check the header first. */
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};
