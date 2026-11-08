CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb
);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'tasks' AND column_name = 'comments'
  ) THEN
    EXECUTE $migration$
      INSERT INTO "task_comments" ("id", "task_id", "user_id", "body", "created_at", "attachments")
      SELECT value->>'id', task."id", task."user_id", value->>'body', (value->>'createdAt')::timestamptz,
             COALESCE(value->'attachments', '[]'::jsonb)
      FROM "tasks" AS task
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(task."comments") = 'array' THEN task."comments" ELSE '[]'::jsonb END
      ) AS expanded(value)
      WHERE value ? 'id' AND value ? 'body' AND value ? 'createdAt'
      ON CONFLICT ("id") DO NOTHING
    $migration$;
  END IF;
END $$;

ALTER TABLE "tasks" DROP COLUMN IF EXISTS "comments";
