/** Преобразует дату в ISO-вид календарного дня без сдвига часового пояса. */
export const toLocalIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Проверяет, совпадает ли срок задачи с сегодняшней локальной датой. */
export const isTaskDueToday = (dueDate: string): boolean => dueDate === toLocalIsoDate(new Date());

/** Возвращает CSS-класс для просроченного или будущего срока задачи. */
export const taskDueDateTone = (dueDate: string): string =>
  dueDate < toLocalIsoDate(new Date()) ? "task-due-date-overdue" : "task-due-date-upcoming";
