CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL UNIQUE,
  "password_hash" text,
  "is_admin" boolean NOT NULL DEFAULT false,
  "confirm_delete" boolean NOT NULL DEFAULT true,
  "inbox_description" text NOT NULL DEFAULT ''
);

INSERT INTO "users" ("id", "username", "password_hash", "is_admin", "confirm_delete", "inbox_description")
SELECT '00000000-0000-4000-8000-000000000001', lower(COALESCE(NULLIF("username", ''), 'admin')), "password_hash", true, "confirm_delete", "inbox_description"
FROM "app_settings" WHERE "id" = 'app'
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_lower_unique" ON "users" (lower("username"));

INSERT INTO "users" ("id", "username", "is_admin") VALUES ('00000000-0000-4000-8000-000000000001', 'admin', true)
ON CONFLICT DO NOTHING;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_id" text;

UPDATE "projects" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id" IS NULL;
UPDATE "sections" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id" IS NULL;
UPDATE "tasks" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id" IS NULL;
UPDATE "sessions" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "sections" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "user_id" SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_user_id_users_id_fk') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sections_user_id_users_id_fk') THEN
    ALTER TABLE "sections" ADD CONSTRAINT "sections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_user_id_users_id_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DROP TABLE IF EXISTS "app_settings";
