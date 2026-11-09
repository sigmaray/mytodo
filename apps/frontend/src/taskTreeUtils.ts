import type { Task, TaskNode } from "@todoist-clone/domain";

export const flattenTaskNodes = (tasks: ReadonlyArray<TaskNode>): ReadonlyArray<Task> =>
  Object.freeze(tasks.flatMap((task) => [task, ...flattenTaskNodes(task.children)]));
