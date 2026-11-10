import type { TaskId, TaskNode } from "@todoist-clone/domain";
import clsx from "clsx";
import { CalendarDays, Edit3, GripVertical, MessageSquare, Paperclip, Plus, Trash2 } from "lucide-react";
import type {
  DragEvent,
  KeyboardEvent,
  ReactElement,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { isTaskDueToday, taskDueDateTone } from "../dateUtils";
import { AutoGrowTextarea } from "./TaskFormFields";

type DragPlacement = "before" | "inside" | "after" | "outdent";

export type ActiveDragTarget = Readonly<{
  taskId: TaskId;
  placement: DragPlacement;
}>;

export const renderTaskNodes = (
  tasks: ReadonlyArray<TaskNode>,
  actions: Readonly<{
    toggleTask: (task: TaskNode) => void;
    startEditing: (task: TaskNode) => void;
    openDetails: (task: TaskNode) => void;
    openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void;
    selectionMode: boolean;
    attachmentsEnabled: boolean;
    selectedTaskIds: ReadonlyArray<TaskId>;
    toggleTaskSelection: (task: TaskNode) => void;
    deleteTask: (task: TaskNode) => void;
    startSubtask: (task: TaskNode) => void;
    submitSubtask: (task: TaskNode) => void;
    cancelSubtask: () => void;
    moveTaskOntoTask: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    markDragTarget: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    clearDragTarget: () => void;
    finishDragging: () => void;
    startDragging: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    startMobileTaskDrag: (task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => void;
    moveMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    finishMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    cancelMobileDrag: () => void;
    handleTaskKeys: (task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => void;
    submitEdit: (task: TaskNode) => void;
    cancelEdit: () => void;
    editTaskId: string | null;
    editTitle: string;
    editPlacement: string;
    subtaskParentId: string | null;
    subtaskTitle: string;
    draggingTaskId: string | null;
    activeDragTarget: ActiveDragTarget | null;
    placementOptions: ReadonlyArray<Readonly<{ value: string; label: string }>>;
    setEditTitle: (title: string) => void;
    setEditPlacement: (placement: string) => void;
    setSubtaskTitle: (title: string) => void;
  }>,
  depth = 0,
): ReactElement => (
  <ul className={depth === 0 ? "task-list" : "task-children"}>
    {tasks.map((task) => (
      <li key={task.id} className="task-item">
        <div
          className={clsx(
            "task-row",
            actions.selectionMode && "selection-mode",
            actions.selectedTaskIds.includes(task.id) && "selection-selected",
            actions.draggingTaskId === task.id && "dragging",
            actions.activeDragTarget?.taskId === task.id && [
              "drag-target",
              `drag-${actions.activeDragTarget.placement}`,
            ],
          )}
          data-task-id={task.id}
          data-task-depth={depth}
          tabIndex={0}
          draggable
          onDragStart={actions.startDragging(task)}
          onDragEnd={actions.finishDragging}
          onDragEnter={actions.markDragTarget(task)}
          onDragOver={actions.markDragTarget(task)}
          onDragLeave={actions.clearDragTarget}
          onDrop={actions.moveTaskOntoTask(task)}
          onKeyDown={actions.handleTaskKeys(task)}
          onClick={() => {
            if (actions.selectionMode) actions.toggleTaskSelection(task);
          }}
          onContextMenu={actions.openContextMenu(task)}
          style={{ paddingLeft: `${depth * 1.25}rem` }}
        >
          <input
            aria-label={`Complete ${task.title}`}
            checked={task.completed}
            type="checkbox"
            onChange={() => actions.toggleTask(task)}
          />
          {actions.editTaskId === task.id ? (
            <form
              className="edit-panel"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  actions.cancelEdit();
                }
              }}
              onSubmit={(event) => {
                event.preventDefault();
                actions.submitEdit(task);
              }}
            >
              <label>
                Title
                <AutoGrowTextarea
                  ariaLabel={`Edit ${task.title}`}
                  autoFocus
                  value={actions.editTitle}
                  onChange={actions.setEditTitle}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      actions.submitEdit(task);
                    }
                  }}
                />
              </label>
              <label>
                Location
                <select
                  aria-label={`Move ${task.title} to`}
                  value={actions.editPlacement}
                  onChange={(event) => actions.setEditPlacement(event.target.value)}
                >
                  {actions.placementOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="edit-panel-actions">
                <button type="submit">Save</button>
                <button type="button" onClick={actions.cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="task-content">
              <button
                type="button"
                className="mobile-task-drag-handle"
                aria-label={`Drag task ${task.title}`}
                onPointerDown={actions.startMobileTaskDrag(task)}
                onPointerMove={actions.moveMobileDrag}
                onPointerUp={actions.finishMobileDrag}
                onPointerCancel={actions.cancelMobileDrag}
              >
                <GripVertical size={16} aria-hidden="true" />
              </button>
              {actions.selectionMode && depth === 0 ? (
                <span className="task-selection-indicator" aria-hidden="true">
                  {actions.selectedTaskIds.includes(task.id) ? "✓" : ""}
                </span>
              ) : null}
              <button
                type="button"
                className={task.completed ? "task-title completed" : "task-title"}
                aria-pressed={actions.selectionMode ? actions.selectedTaskIds.includes(task.id) : undefined}
                onClick={() => {
                  if (!actions.selectionMode) actions.openDetails(task);
                }}
              >
                {task.title}
              </button>
              {task.description.trim() ? (
                <span className="task-description-preview" title={task.description}>
                  {task.description}
                </span>
              ) : null}
              {task.dueDate || task.labels.length > 0 || task.comments.length > 0 ? (
                <span className="task-meta-list">
                  {task.dueDate ? (
                    <time
                      className={taskDueDateTone(task.dueDate)}
                      dateTime={task.dueDate}
                      title={`Due ${task.dueDate}`}
                    >
                      <CalendarDays size={14} aria-hidden="true" />
                      <span>{isTaskDueToday(task.dueDate) ? "today" : task.dueDate}</span>
                    </time>
                  ) : null}
                  {task.labels.map((label) => (
                    <a className="task-label" key={label} href={`/labels?label=${encodeURIComponent(label)}`}>
                      {label}
                    </a>
                  ))}
                  {task.comments.length > 0 ? (
                    <span
                      className="task-comment-count"
                      aria-label={`${task.comments.length} ${task.comments.length === 1 ? "comment" : "comments"}`}
                      title={`${task.comments.length} ${task.comments.length === 1 ? "comment" : "comments"}`}
                    >
                      <MessageSquare size={14} aria-hidden="true" />
                      <span aria-hidden="true">{task.comments.length}</span>
                    </span>
                  ) : null}
                  {actions.attachmentsEnabled &&
                  task.comments.some((comment) => (comment.attachments?.length ?? 0) > 0) ? (
                    <span
                      className="task-attachment-indicator"
                      aria-label="Task has attachments"
                      title="Attachments"
                    >
                      <Paperclip size={14} aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          )}
          <button
            type="button"
            className="task-action"
            aria-label={`Edit task ${task.title}`}
            onClick={() => actions.startEditing(task)}
          >
            <Edit3 size={14} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            className="task-action"
            aria-label={`Add subtask to ${task.title}`}
            onClick={() => actions.startSubtask(task)}
          >
            <Plus size={14} aria-hidden="true" />
            Subtask
          </button>
          <button
            type="button"
            className="task-action danger"
            aria-label={`Delete task ${task.title}`}
            onClick={() => actions.deleteTask(task)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
        {actions.subtaskParentId === task.id ? (
          <form
            className="subtask-form"
            style={{ marginLeft: `${depth * 1.25 + 2.1}rem` }}
            onSubmit={(event) => {
              event.preventDefault();
              actions.submitSubtask(task);
            }}
          >
            <label htmlFor={`subtask-${task.id}`}>Subtask for {task.title}</label>
            <AutoGrowTextarea
              id={`subtask-${task.id}`}
              ariaLabel={`Subtask for ${task.title}`}
              autoFocus
              value={actions.subtaskTitle}
              onChange={actions.setSubtaskTitle}
              placeholder="Add a subtask"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  actions.submitSubtask(task);
                }
              }}
            />
            <button type="submit">Add subtask</button>
            <button type="button" onClick={actions.cancelSubtask}>
              Cancel
            </button>
          </form>
        ) : null}
        {task.children.length > 0 ? renderTaskNodes(task.children, actions, depth + 1) : null}
      </li>
    ))}
  </ul>
);
