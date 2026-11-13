import type { Task, TaskNode } from "@todoist-clone/domain";
import { Link } from "react-router-dom";
import { renderTaskNodes } from "../components/TaskTreeView";

export type LabelsPageProps = {
  selectedLabel: string;
  viewTitle: string;
  flatTasks: Array<Task>;
  viewTasks: Array<TaskNode>;
  taskActions: Parameters<typeof renderTaskNodes>[1];
};

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
