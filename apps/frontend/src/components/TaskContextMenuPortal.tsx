import type { TaskNode } from "@todoist-clone/domain";
import { createPortal } from "react-dom";

/** Задача, позиция и действия всплывающего контекстного меню. */
type TaskContextMenuPortalProps = {
  /** Выбранная задача или `null`, когда меню закрыто. */
  task: TaskNode | null;
  /** Горизонтальная экранная координата меню. */
  left: number;
  /** Вертикальная экранная координата меню. */
  top: number;
  /** Открывает подробности задачи. */
  onOpen: () => void;
  /** Начинает быстрое редактирование задачи. */
  onQuickEdit: () => void;
  /** Создаёт дочернюю задачу. */
  onAddSubtask: () => void;
  /** Удаляет задачу и её подзадачи. */
  onDelete: () => void;
};

/** Рендерит меню действий в portal рядом с выбранной задачей. */
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
