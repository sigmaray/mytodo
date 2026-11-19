/**
 * Converts a date to an ISO calendar day without shifting its time zone.
 *
 * @param {Date} date
 * @returns {string}
 */
export const toLocalIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Checks whether a task due date matches today's local date.
 *
 * @param {string} dueDate
 * @returns {boolean}
 */
export const isTaskDueToday = (dueDate: string): boolean => dueDate === toLocalIsoDate(new Date());

/**
 * Returns the CSS class for a task's overdue or upcoming due date.
 *
 * @param {string} dueDate
 * @returns {string}
 */
export const taskDueDateTone = (dueDate: string): string =>
  dueDate < toLocalIsoDate(new Date()) ? "task-due-date-overdue" : "task-due-date-upcoming";
