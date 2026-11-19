-- Removes the priority field, which is not part of the current product model.
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "priority";
