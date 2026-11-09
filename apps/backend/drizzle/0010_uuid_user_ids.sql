-- Replace the historical sentinel with a real UUID and make user identity columns native UUIDs.
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_user_id_users_id_fk";
ALTER TABLE "sections" DROP CONSTRAINT IF EXISTS "sections_user_id_users_id_fk";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_user_id_users_id_fk";
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_users_id_fk";
ALTER TABLE "task_comments" DROP CONSTRAINT IF EXISTS "task_comments_user_fk";
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_parent_user_fk";
ALTER TABLE "sections" DROP CONSTRAINT IF EXISTS "sections_project_user_fk";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_parent_user_fk";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_project_user_fk";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_section_user_fk";
ALTER TABLE "task_comments" DROP CONSTRAINT IF EXISTS "task_comments_task_user_fk";
DROP TRIGGER IF EXISTS "tasks_section_project_match" ON "tasks";

UPDATE "projects" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id"::text = 'legacy-admin';
UPDATE "sections" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id"::text = 'legacy-admin';
UPDATE "tasks" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id"::text = 'legacy-admin';
UPDATE "sessions" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id"::text = 'legacy-admin';
UPDATE "task_comments" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id"::text = 'legacy-admin';
UPDATE "users" SET "id" = '00000000-0000-4000-8000-000000000001' WHERE "id"::text = 'legacy-admin';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "id"::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Cannot migrate users: a user ID is not a UUID';
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "projects" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
ALTER TABLE "sections" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
ALTER TABLE "tasks" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
ALTER TABLE "sessions" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
ALTER TABLE "task_comments" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;

ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
ALTER TABLE "sections" ADD CONSTRAINT "sections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_user_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_user_fk" FOREIGN KEY ("parent_id", "user_id") REFERENCES "projects" ("id", "user_id");
ALTER TABLE "sections" ADD CONSTRAINT "sections_project_user_fk" FOREIGN KEY ("project_id", "user_id") REFERENCES "projects" ("id", "user_id");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_user_fk" FOREIGN KEY ("parent_id", "user_id") REFERENCES "tasks" ("id", "user_id");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_user_fk" FOREIGN KEY ("project_id", "user_id") REFERENCES "projects" ("id", "user_id");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_section_user_fk" FOREIGN KEY ("section_id", "user_id") REFERENCES "sections" ("id", "user_id");
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_user_fk" FOREIGN KEY ("task_id", "user_id") REFERENCES "tasks" ("id", "user_id") ON DELETE CASCADE;

CREATE TRIGGER "tasks_section_project_match"
BEFORE INSERT OR UPDATE OF "section_id", "project_id", "user_id" ON "tasks"
FOR EACH ROW EXECUTE FUNCTION enforce_task_section_project_match();
