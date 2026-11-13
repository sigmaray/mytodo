import type { Task, TaskNode } from "@todoist-clone/domain";

export const flattenTaskNodes = (tasks: Array<TaskNode>): Array<Task> =>
  tasks.flatMap((task) => [task, ...flattenTaskNodes(task.children)]);
