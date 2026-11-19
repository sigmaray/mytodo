-- Allows nested projects by adding a parent project reference.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "parent_id" text;
