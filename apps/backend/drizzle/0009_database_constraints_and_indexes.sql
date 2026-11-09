-- Tighten task dates and JSON shape, and index common FK/delete and sibling-order lookups.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'tasks'
      AND column_name = 'due_date' AND data_type = 'text'
  ) THEN
    ALTER TABLE "tasks"
      ALTER COLUMN "due_date" TYPE date
      USING CASE
        WHEN "due_date" ~ '^\\d{4}-\\d{2}-\\d{2}$'
          AND to_char(to_date("due_date", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "due_date"
        THEN "due_date"::date
        ELSE NULL
      END;
  END IF;
END $$;

-- Normalize pre-existing task placements before enforcing the invariant.
UPDATE "tasks" AS task
SET "project_id" = section."project_id"
FROM "sections" AS section
WHERE task."section_id" = section."id"
  AND task."user_id" = section."user_id"
  AND task."project_id" IS DISTINCT FROM section."project_id";

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_attachments_array_check'
  ) THEN
    ALTER TABLE "task_comments"
      ADD CONSTRAINT "task_comments_attachments_array_check"
      CHECK (jsonb_typeof("attachments") = 'array');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_task_section_project_match()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."section_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "sections" AS section
    WHERE section."id" = NEW."section_id"
      AND section."user_id" = NEW."user_id"
      AND section."project_id" IS NOT DISTINCT FROM NEW."project_id"
  ) THEN
    RAISE EXCEPTION 'task section must belong to the selected project'
      USING ERRCODE = '23514', CONSTRAINT = 'tasks_section_project_match';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "tasks_section_project_match" ON "tasks";
CREATE TRIGGER "tasks_section_project_match"
BEFORE INSERT OR UPDATE OF "section_id", "project_id", "user_id" ON "tasks"
FOR EACH ROW EXECUTE FUNCTION enforce_task_section_project_match();

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");
CREATE INDEX IF NOT EXISTS "projects_parent_user_idx" ON "projects" ("parent_id", "user_id");
CREATE INDEX IF NOT EXISTS "sections_project_user_idx" ON "sections" ("project_id", "user_id");
CREATE INDEX IF NOT EXISTS "tasks_parent_user_idx" ON "tasks" ("parent_id", "user_id");
CREATE INDEX IF NOT EXISTS "tasks_project_user_idx" ON "tasks" ("project_id", "user_id");
CREATE INDEX IF NOT EXISTS "tasks_section_user_idx" ON "tasks" ("section_id", "user_id");
CREATE INDEX IF NOT EXISTS "tasks_user_parent_project_section_order_idx"
  ON "tasks" ("user_id", "parent_id", "project_id", "section_id", "lexical_order");
CREATE INDEX IF NOT EXISTS "task_comments_user_id_idx" ON "task_comments" ("user_id");
