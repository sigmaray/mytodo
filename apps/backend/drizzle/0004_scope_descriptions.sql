-- Adds descriptions for projects and the Inbox.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "inbox_description" text NOT NULL DEFAULT '';
