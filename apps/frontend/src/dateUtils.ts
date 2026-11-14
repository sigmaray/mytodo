/**
 * Преобразует дату в ISO-вид календарного дня без сдвига часового пояса.
 *
 * @param {Date} date
 * @returns {string}
 */
export const toLocalIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Проверяет, совпадает ли срок задачи с сегодняшней локальной датой.
 *
 * @param {string} dueDate
 * @returns {boolean}
 */
export const isTaskDueToday = (dueDate: string): boolean => dueDate === toLocalIsoDate(new Date());

/**
 * Возвращает CSS-класс для просроченного или будущего срока задачи.
 *
 * @param {string} dueDate
 * @returns {string}
 */
export const taskDueDateTone = (dueDate: string): string =>
  dueDate < toLocalIsoDate(new Date()) ? "task-due-date-overdue" : "task-due-date-upcoming";
