import type { TaskNode } from "@todoist-clone/domain";
import { createPortal } from "react-dom";

/**
 * @callback TaskContextMenuPortalPropsOnOpen
 * @returns {void}
 */

/**
 * @callback TaskContextMenuPortalPropsOnQuickEdit
 * @returns {void}
 */

/**
 * @callback TaskContextMenuPortalPropsOnAddSubtask
 * @returns {void}
 */

/**
 * @callback TaskContextMenuPortalPropsOnDelete
 * @returns {void}
 */
/**
 * Задача, позиция и действия всплывающего контекстного меню.
 *
 * @typedef {Object} TaskContextMenuPortalProps
 * @property {TaskNode | null} task - Данные «задача», используемые типом «TaskContextMenuPortalProps».
 * @property {number} left - Горизонтальная координата меню.
 * @property {number} top - Вертикальная координата меню.
 * @property {TaskContextMenuPortalPropsOnOpen} onOpen - Открывает диалог или элемент.
 * @property {TaskContextMenuPortalPropsOnQuickEdit} onQuickEdit - Открывает быстрое редактирование задачи.
 * @property {TaskContextMenuPortalPropsOnAddSubtask} onAddSubtask - Создаёт подзадачу.
 * @property {TaskContextMenuPortalPropsOnDelete} onDelete - Удаляет выбранный элемент.
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
 * Рендерит меню действий в portal рядом с выбранной задачей.
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
