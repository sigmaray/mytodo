import type { Task, TaskNode } from "@todoist-clone/domain";
import { Link } from "react-router-dom";
import { renderTaskNodes } from "../components/TaskTreeView";

/** Списки и действия для страницы фильтрации задач по метке. */
export type LabelsPageProps = {
  /** Метка, выбранная в URL или пустая строка для всех задач. */
  selectedLabel: string;
  /** Заголовок области, показываемый над списком. */
  viewTitle: string;
  /** Все задачи для построения списка доступных меток. */
  flatTasks: Array<Task>;
  /** Дерево задач, отфильтрованное по выбранной метке. */
  viewTasks: Array<TaskNode>;
  /** Действия над строками дерева задач. */
  taskActions: Parameters<typeof renderTaskNodes>[1];
};

/** Показывает доступные метки и дерево задач для выбранного фильтра. */
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
