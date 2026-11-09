-- Repair invalid legacy links before enforcing same-user relationships.
UPDATE "projects" AS child SET "parent_id" = NULL
WHERE child."parent_id" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "projects" AS parent WHERE parent."id" = child."parent_id" AND parent."user_id" = child."user_id"
);
UPDATE "sections" AS section SET "project_id" = NULL
WHERE section."project_id" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "projects" AS project WHERE project."id" = section."project_id" AND project."user_id" = section."user_id"
);
UPDATE "tasks" AS task SET "parent_id" = NULL
WHERE task."parent_id" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "tasks" AS parent WHERE parent."id" = task."parent_id" AND parent."user_id" = task."user_id"
);
UPDATE "tasks" AS task SET "project_id" = NULL
WHERE task."project_id" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "projects" AS project WHERE project."id" = task."project_id" AND project."user_id" = task."user_id"
);
UPDATE "tasks" AS task SET "section_id" = NULL
WHERE task."section_id" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "sections" AS section WHERE section."id" = task."section_id" AND section."user_id" = task."user_id"
);
UPDATE "task_comments" AS comment SET "user_id" = task."user_id"
FROM "tasks" AS task WHERE comment."task_id" = task."id" AND comment."user_id" <> task."user_id";

CREATE UNIQUE INDEX IF NOT EXISTS "projects_id_user_id_uq" ON "projects" ("id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sections_id_user_id_uq" ON "sections" ("id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_id_user_id_uq" ON "tasks" ("id", "user_id");
CREATE INDEX IF NOT EXISTS "projects_user_parent_idx" ON "projects" ("user_id", "parent_id");
CREATE INDEX IF NOT EXISTS "sections_user_project_idx" ON "sections" ("user_id", "project_id");
CREATE INDEX IF NOT EXISTS "tasks_user_parent_idx" ON "tasks" ("user_id", "parent_id");
CREATE INDEX IF NOT EXISTS "tasks_user_project_idx" ON "tasks" ("user_id", "project_id");
CREATE INDEX IF NOT EXISTS "tasks_user_section_idx" ON "tasks" ("user_id", "section_id");
CREATE INDEX IF NOT EXISTS "task_comments_task_user_created_idx" ON "task_comments" ("task_id", "user_id", "created_at", "id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_parent_user_fk') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_user_fk"
      FOREIGN KEY ("parent_id", "user_id") REFERENCES "projects" ("id", "user_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sections_project_user_fk') THEN
    ALTER TABLE "sections" ADD CONSTRAINT "sections_project_user_fk"
      FOREIGN KEY ("project_id", "user_id") REFERENCES "projects" ("id", "user_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_parent_user_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_user_fk"
      FOREIGN KEY ("parent_id", "user_id") REFERENCES "tasks" ("id", "user_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_project_user_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_user_fk"
      FOREIGN KEY ("project_id", "user_id") REFERENCES "projects" ("id", "user_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_section_user_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_section_user_fk"
      FOREIGN KEY ("section_id", "user_id") REFERENCES "sections" ("id", "user_id");
  END IF;
  ALTER TABLE "task_comments" DROP CONSTRAINT IF EXISTS "task_comments_task_id_tasks_id_fk";
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_task_user_fk') THEN
    ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_user_fk"
      FOREIGN KEY ("task_id", "user_id") REFERENCES "tasks" ("id", "user_id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_user_fk') THEN
    ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_user_fk"
      FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
  END IF;
END $$;
