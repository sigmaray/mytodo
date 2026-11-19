import type { Task, TaskNode } from "@todoist-clone/domain";

/**
 * Flattens the task tree by traversing each parent and its descendants.
 *
 * @param {Array<TaskNode>} tasks
 * @returns {Array<Task>}
 */
export const flattenTaskNodes = (tasks: Array<TaskNode>): Array<Task> =>
  tasks.flatMap((task) => [task, ...flattenTaskNodes(task.children)]);
