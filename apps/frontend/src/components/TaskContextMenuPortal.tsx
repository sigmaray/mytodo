import type { TaskNode } from "@todoist-clone/domain";
import { createPortal } from "react-dom";

type TaskContextMenuPortalProps = Readonly<{
  task: TaskNode | null;
  left: number;
  top: number;
  onOpen: () => void;
  onQuickEdit: () => void;
  onAddSubtask: () => void;
  onDelete: () => void;
}>;

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
