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

/**
 * Position of a dragged task relative to another row in the tree.
 *
 * @typedef {"before" | "inside" | "after" | "outdent"} DragPlacement
 */
type DragPlacement = "before" | "inside" | "after" | "outdent";

/**
 * Active task and computed placement highlighted during drag and drop.
 *
 * @typedef {Object} ActiveDragTarget
 * @property {TaskId} taskId - ID of the task being dragged.
 * @property {DragPlacement} placement - Item position in the tree or list.
 */
export type ActiveDragTarget = {
  taskId: TaskId;

  placement: DragPlacement;
};

/**
 * Recursively renders the task tree and connects items to workspace actions.
 *
 * @param {Array<TaskNode>} tasks
 * @param {{ toggleTask: (task: TaskNode) => void; startEditing: (task: TaskNode) => void; openDetails: (task: TaskNode) => void; openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void; selectionMode: boolean; attachmentsEnabled: boolean; selectedTaskIds: Array<TaskId>; toggleTaskSelection: (task: TaskNode) => void; deleteTask: (task: TaskNode) => void; startSubtask: (task: TaskNode) => void; submitSubtask: (task: TaskNode) => void; cancelSubtask: () => void; moveTaskOntoTask: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void; markDragTarget: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void; clearDragTarget: () => void; finishDragging: () => void; startDragging: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void; startMobileTaskDrag: (task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => void; moveMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void; finishMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void; cancelMobileDrag: () => void; handleTaskKeys: (task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => void; submitEdit: (task: TaskNode) => void; cancelEdit: () => void; editTaskId: string | null; editTitle: string; editPlacement: string; subtaskParentId: string | null; subtaskTitle: string; draggingTaskId: string | null; activeDragTarget: ActiveDragTarget | null; placementOptions: Array<{ value: string; label: string }>; setEditTitle: (title: string) => void; setEditPlacement: (placement: string) => void; setSubtaskTitle: (title: string) => void; }} actions
 * @param {(task: TaskNode) => void} actions.toggleTask - Toggles the task completion status.
 * @param {(task: TaskNode) => void} actions.startEditing - Opens the task title and placement editor.
 * @param {(task: TaskNode) => void} actions.openDetails - Opens task details.
 * @param {(task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void} actions.openContextMenu - Opens the action menu at the pointer position.
 * @param {boolean} actions.selectionMode - Enables multi-select for task rows.
 * @param {boolean} actions.attachmentsEnabled - Whether attachments can be uploaded in the application.
 * @param {Array<TaskId>} actions.selectedTaskIds - IDs of the selected tasks.
 * @param {(task: TaskNode) => void} actions.toggleTaskSelection - Adds or removes a task from the selection.
 * @param {(task: TaskNode) => void} actions.deleteTask - Deletes a task and its descendants.
 * @param {(task: TaskNode) => void} actions.startSubtask - Opens the subtask form for the specified task.
 * @param {(task: TaskNode) => void} actions.submitSubtask - Saves the subtask being entered.
 * @param {() => void} actions.cancelSubtask - Closes the subtask form without saving.
 * @param {(task: TaskNode) => (event: DragEvent<HTMLElement>) => void} actions.moveTaskOntoTask - Handles an HTML drag and drop onto a task.
 * @param {(task: TaskNode) => (event: DragEvent<HTMLElement>) => void} actions.markDragTarget - Marks a valid drop position for the dragged task.
 * @param {() => void} actions.clearDragTarget - Clears the current drop target highlight.
 * @param {() => void} actions.finishDragging - Finishes the mouse drag.
 * @param {(task: TaskNode) => (event: DragEvent<HTMLElement>) => void} actions.startDragging - Starts the mouse drag.
 * @param {(task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => void} actions.startMobileTaskDrag - Starts a mobile drag using Pointer Events.
 * @param {(event: ReactPointerEvent<HTMLButtonElement>) => void} actions.moveMobileDrag - Updates the mobile drop zone as the pointer moves.
 * @param {(event: ReactPointerEvent<HTMLButtonElement>) => void} actions.finishMobileDrag - Finishes the mobile gesture and applies the pending move.
 * @param {() => void} actions.cancelMobileDrag - Cancels the unfinished mobile gesture.
 * @param {(task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => void} actions.handleTaskKeys - Handles keyboard commands for a task row.
 * @param {(task: TaskNode) => void} actions.submitEdit - Saves changes from the task form.
 * @param {() => void} actions.cancelEdit - Cancels task editing.
 * @param {string | null} actions.editTaskId - ID of the task currently being edited.
 * @param {string} actions.editTitle - Current value of the task title field.
 * @param {string} actions.editPlacement - Selected project or section in the edit form.
 * @param {string | null} actions.subtaskParentId - ID of the parent task for the open subtask form.
 * @param {string} actions.subtaskTitle - Current subtask title.
 * @param {string | null} actions.draggingTaskId - ID of the task currently being dragged.
 * @param {ActiveDragTarget | null} actions.activeDragTarget - Currently highlighted drop target.
 * @param {Array<{ value: string; label: string }>} actions.placementOptions - Placement options available in the task move form.
 * @param {(title: string) => void} actions.setEditTitle - Updates the title in the edit form.
 * @param {(placement: string) => void} actions.setEditPlacement - Updates the destination project or section in the edit form.
 * @param {(title: string) => void} actions.setSubtaskTitle - Updates the new subtask title.
 * @param [depth]
 * @returns {ReactElement}
 */
export const renderTaskNodes = (
  tasks: Array<TaskNode>,
  actions: {
    toggleTask: (task: TaskNode) => void;

    startEditing: (task: TaskNode) => void;

    openDetails: (task: TaskNode) => void;

    openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void;

    selectionMode: boolean;

    attachmentsEnabled: boolean;

    selectedTaskIds: Array<TaskId>;

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

    placementOptions: Array<{ value: string; label: string }>;

    setEditTitle: (title: string) => void;

    setEditPlacement: (placement: string) => void;

    setSubtaskTitle: (title: string) => void;
  },
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
            /** Clicking a row changes its selection only in bulk action mode. */
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
                  /** Escape closes the inline editor without submitting the form. */
                  event.preventDefault();
                  actions.cancelEdit();
                }
              }}
              onSubmit={(event) => {
                /** Prevent default form navigation and delegate saving to the action hook. */
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
                      /** Enter saves the title; Shift+Enter inserts a new line. */
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
                  /** In multi-select mode, clicking the title does not open the sidebar. */
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
              /** Create the subtask without reloading the page. */
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
                  /** Enter saves the subtask; Shift+Enter remains available for text input. */
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
