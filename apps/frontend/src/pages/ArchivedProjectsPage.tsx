import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, TaskNode } from "@todoist-clone/domain";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import type { ApplicationApi } from "../api";
import { isTaskDueToday, taskDueDateTone } from "../dateUtils";
import { projectQueryKey, taskQueryKey } from "../queryKeys";

export const ArchivedProjectsPage = ({
  api,
  sidebar,
}: Readonly<{ api: ApplicationApi; sidebar?: ReactNode }>) => {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(null);
  const projects = useQuery({ queryKey: projectQueryKey, queryFn: api.listProjects });
  const tasks = useQuery({ queryKey: taskQueryKey, queryFn: api.listTasks });
  const archived = (projects.data ?? []).filter((project) => project.archived);
  const restore = async (project: Project) => {
    await api.archiveProject(project.id, false);
    await queryClient.invalidateQueries({ queryKey: projectQueryKey });
  };
  const remove = async (project: Project) => {
    if (!window.confirm(`Delete project “${project.title}” and all its tasks?`)) return;
    await api.deleteProject(project.id);
    await queryClient.invalidateQueries({ queryKey: projectQueryKey });
    await queryClient.invalidateQueries({ queryKey: taskQueryKey });
  };
  const renderTasks = (nodes: ReadonlyArray<TaskNode>): ReactElement => (
    <ul className="archived-task-tree">
      {nodes.map((task) => (
        <li key={task.id}>
          <strong>{task.title}</strong>
          {task.description ? <p>{task.description}</p> : null}
          <div className="archived-task-meta">
            {task.dueDate ? (
              <span className={clsx("archived-task-due-date", taskDueDateTone(task.dueDate))}>
                <CalendarDays size={14} aria-hidden="true" />
                {isTaskDueToday(task.dueDate) ? "today" : task.dueDate}
              </span>
            ) : null}
            {task.labels.map((label) => (
              <span className="badge text-bg-light" key={label}>
                {label}
              </span>
            ))}
          </div>
          {task.children.length ? renderTasks(task.children) : null}
        </li>
      ))}
    </ul>
  );
  const selectedProject = archived.find((project) => project.id === selectedProjectId);
  const archivedTaskRoots = (tasks.data ?? []).filter(
    (task) => task.projectId === selectedProjectId && task.parentId === null,
  );
  return (
    <main className="shell app-layout">
      {sidebar}
      <section className="workspace card shadow-sm">
        <h1>Archived projects</h1>
        {archived.length === 0 ? (
          <p className="empty">No archived projects.</p>
        ) : (
          archived.map((project) => (
            <article className="archived-project" key={project.id}>
              <strong>{project.title}</strong>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedProjectId((current) => (current === project.id ? null : project.id))
                  }
                >
                  {selectedProjectId === project.id ? "Hide tasks" : "View tasks"}
                </button>
                <button type="button" onClick={() => void restore(project)}>
                  Restore
                </button>
                <button type="button" className="danger" onClick={() => void remove(project)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
        {selectedProject !== undefined ? (
          <section className="archived-task-view" aria-label={`${selectedProject.title} tasks`}>
            <h2>{selectedProject.title} tasks</h2>
            {tasks.isLoading ? (
              <p>Loading tasks…</p>
            ) : archivedTaskRoots.length === 0 ? (
              <p className="empty">This project has no tasks.</p>
            ) : (
              renderTasks(archivedTaskRoots)
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
};
