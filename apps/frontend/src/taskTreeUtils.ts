import type { Task, TaskNode } from "@todoist-clone/domain";

/**
 * Превращает дерево задач в плоский список обходом родителя и его потомков.
 *
 * @param {Array<TaskNode>} tasks
 * @returns {Array<Task>}
 */
export const flattenTaskNodes = (tasks: Array<TaskNode>): Array<Task> =>
  tasks.flatMap((task) => [task, ...flattenTaskNodes(task.children)]);
