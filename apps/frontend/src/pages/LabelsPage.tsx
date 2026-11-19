import type { Task, TaskNode } from "@todoist-clone/domain";
import { Link } from "react-router-dom";
import { renderTaskNodes } from "../components/TaskTreeView";

/**
 * Lists and actions for the task label filter page.
 *
 * @typedef {Object} LabelsPageProps
 * @property {string} selectedLabel - Label used to filter tasks.
 * @property {string} viewTitle - Label page title.
 * @property {Array<Task>} flatTasks - Flat task list used for label filtering.
 * @property {Array<TaskNode>} viewTasks - Task tree filtered by the selected label.
 * @property {Parameters<typeof renderTaskNodes>[1]} taskActions - Task action handlers.
 */
export type LabelsPageProps = {
  selectedLabel: string;

  viewTitle: string;

  flatTasks: Array<Task>;

  viewTasks: Array<TaskNode>;

  taskActions: Parameters<typeof renderTaskNodes>[1];
};

/**
 * Shows available labels and the task tree for the selected filter.
 *
 * @param {LabelsPageProps} parameter1
 */
export const LabelsPage = ({
  selectedLabel,
  viewTitle,
  flatTasks,
  viewTasks,
  taskActions,
}: LabelsPageProps) => (
  <section className="drop-zone task-filter-page" aria-label={`${viewTitle} tasks`}>
    <nav className="label-filter-list" aria-label="Filter by label">
      <Link className={!selectedLabel ? "active" : ""} to="/labels">
        All labels
      </Link>
      {Array.from(new Set(flatTasks.flatMap((task) => task.labels)))
        .sort()
        .map((label) => (
          <Link
            key={label}
            className={selectedLabel === label ? "active" : ""}
            to={`/labels?label=${encodeURIComponent(label)}`}
          >
            {label}
          </Link>
        ))}
    </nav>
    {viewTasks.length > 0 ? (
      renderTaskNodes(viewTasks, taskActions)
    ) : (
      <p className="empty">No tasks with this label.</p>
    )}
  </section>
);
