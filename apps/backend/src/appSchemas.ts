import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  sectionId: z.string().nullable().default(null),
});

export const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
});
export const createSectionSchema = z.object({
  title: z.string().trim().min(1),
  projectId: z.string().nullable().default(null),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1),
});

export const updateSettingsSchema = z.object({
  confirmDelete: z.boolean(),
});
export const updateAccountSchema = z
  .object({ username: z.string().trim().min(1).max(64).optional(), password: z.string().min(1).optional() })
  .refine((patch) => Object.keys(patch).length > 0);
export const createUserSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1),
  isAdmin: z.boolean().default(false),
});
export const updateUserSchema = z
  .object({
    username: z.string().trim().min(1).max(64).optional(),
    password: z.string().min(1).optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0);
export const inboxDescriptionSchema = z.object({ description: z.string().max(20000) });

export const parseJson = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};
