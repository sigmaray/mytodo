-- Adds descriptions, due dates, labels, comments, and project archive status.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "due_date" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "labels" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "comments" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived" boolean NOT NULL DEFAULT false;
