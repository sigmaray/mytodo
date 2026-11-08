export const toLocalIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const isTaskDueToday = (dueDate: string): boolean => dueDate === toLocalIsoDate(new Date());

export const taskDueDateTone = (dueDate: string): string =>
  dueDate < toLocalIsoDate(new Date()) ? "task-due-date-overdue" : "task-due-date-upcoming";
