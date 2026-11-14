-- Разрешает создавать вложенные проекты через ссылку на родительский проект.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "parent_id" text;
