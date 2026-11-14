-- Удаляет поле приоритета, исключённое из актуальной модели продукта.
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "priority";
