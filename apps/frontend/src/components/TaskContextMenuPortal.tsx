import type { TaskNode } from "@todoist-clone/domain";
import { createPortal } from "react-dom";

/**
 * Task, position, and actions for the floating context menu.
 *
 * @typedef {Object} TaskContextMenuPortalProps
 * @property {TaskNode | null} task - Task shown in the context menu.
 * @property {number} left - Horizontal position of the menu.
 * @property {number} top - Vertical position of the menu.
 * @property onOpen - Opens the dialog or item.
 * @property onQuickEdit - Opens the task quick editor.
 * @property onAddSubtask - Creates a subtask.
 * @property onDelete - Deletes the selected item.
 */
type TaskContextMenuPortalProps = {
  task: TaskNode | null;

  left: number;

  top: number;

  onOpen: () => void;

  onQuickEdit: () => void;

  onAddSubtask: () => void;

  onDelete: () => void;
};

/**
 * Renders the action menu in a portal next to the selected task.
 *
 * @param {TaskContextMenuPortalProps} parameter1
 */
export const TaskContextMenuPortal = ({
  task,
  left,
  top,
  onOpen,
  onQuickEdit,
  onAddSubtask,
  onDelete,
}: TaskContextMenuPortalProps) =>
  task === null
    ? null
    : createPortal(
        <div
          className="task-context-menu"
          role="menu"
          aria-label={`Task actions for ${task.title}`}
          style={{ left, top }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" role="menuitem" onClick={onOpen}>
            Open
          </button>
          <button type="button" role="menuitem" onClick={onQuickEdit}>
            Quick edit
          </button>
          <button type="button" role="menuitem" onClick={onAddSubtask}>
            Add subtask
          </button>
          <button type="button" role="menuitem" className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>,
        document.body,
      );
