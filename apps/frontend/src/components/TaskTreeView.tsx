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
 * Положение перетаскиваемой задачи относительно другой строки дерева.
 *
 * @typedef {"before" | "inside" | "after" | "outdent"} DragPlacement
 */
type DragPlacement = "before" | "inside" | "after" | "outdent";

/**
 * Активная задача и вычисленное место, подсвечиваемое во время drag-and-drop.
 *
 * @typedef {Object} ActiveDragTarget
 * @property {TaskId} taskId - Данные «задача id», используемые типом «ActiveDragTarget».
 * @property {DragPlacement} placement - Позиция элемента в дереве или списке.
 */
export type ActiveDragTarget = {
  taskId: TaskId;

  placement: DragPlacement;
};

/**
 * Рекурсивно отображает дерево задач и связывает элементы с действиями workspace.
 *
 * @param {Array<TaskNode>} tasks
 * @param {{ toggleTask: (task: TaskNode) => void; startEditing: (task: TaskNode) => void; openDetails: (task: TaskNode) => void; openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void; selectionMode: boolean; attachmentsEnabled: boolean; selectedTaskIds: Array<TaskId>; toggleTaskSelection: (task: TaskNode) => void; deleteTask: (task: TaskNode) => void; startSubtask: (task: TaskNode) => void; submitSubtask: (task: TaskNode) => void; cancelSubtask: () => void; moveTaskOntoTask: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void; markDragTarget: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void; clearDragTarget: () => void; finishDragging: () => void; startDragging: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void; startMobileTaskDrag: (task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => void; moveMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void; finishMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void; cancelMobileDrag: () => void; handleTaskKeys: (task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => void; submitEdit: (task: TaskNode) => void; cancelEdit: () => void; editTaskId: string | null; editTitle: string; editPlacement: string; subtaskParentId: string | null; subtaskTitle: string; draggingTaskId: string | null; activeDragTarget: ActiveDragTarget | null; placementOptions: Array<{ value: string; label: string }>; setEditTitle: (title: string) => void; setEditPlacement: (placement: string) => void; setSubtaskTitle: (title: string) => void; }} actions
 * @param {(task: TaskNode) => void} actions.toggleTask - Переключает состояние завершения задачи.
 * @param {(task: TaskNode) => void} actions.startEditing - Открывает редактирование названия и размещения задачи.
 * @param {(task: TaskNode) => void} actions.openDetails - Открывает подробности задачи.
 * @param {(task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void} actions.openContextMenu - Открывает меню действий у указателя.
 * @param {boolean} actions.selectionMode - Включает множественный режим выбора строк.
 * @param {boolean} actions.attachmentsEnabled - Разрешена ли загрузка вложений в приложении.
 * @param {Array<TaskId>} actions.selectedTaskIds - Идентификаторы выбранных задач.
 * @param {(task: TaskNode) => void} actions.toggleTaskSelection - Добавляет или убирает задачу из выбранных.
 * @param {(task: TaskNode) => void} actions.deleteTask - Удаляет задачу и её потомков.
 * @param {(task: TaskNode) => void} actions.startSubtask - Открывает форму подзадачи для указанной задачи.
 * @param {(task: TaskNode) => void} actions.submitSubtask - Сохраняет вводимую подзадачу.
 * @param {() => void} actions.cancelSubtask - Закрывает форму подзадачи без сохранения.
 * @param {(task: TaskNode) => (event: DragEvent<HTMLElement>) => void} actions.moveTaskOntoTask - Обрабатывает HTML drag-and-drop сброс поверх задачи.
 * @param {(task: TaskNode) => (event: DragEvent<HTMLElement>) => void} actions.markDragTarget - Отмечает позицию, на которую можно сбросить перетаскиваемую задачу.
 * @param {() => void} actions.clearDragTarget - Снимает текущую подсветку места сброса.
 * @param {() => void} actions.finishDragging - Завершает перетаскивание мышью.
 * @param {(task: TaskNode) => (event: DragEvent<HTMLElement>) => void} actions.startDragging - Запускает перетаскивание мышью.
 * @param {(task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => void} actions.startMobileTaskDrag - Запускает мобильное перетаскивание через Pointer Events.
 * @param {(event: ReactPointerEvent<HTMLButtonElement>) => void} actions.moveMobileDrag - Обновляет мобильную drop-zone при движении указателя.
 * @param {(event: ReactPointerEvent<HTMLButtonElement>) => void} actions.finishMobileDrag - Завершает мобильный жест и выполняет назначенное перемещение.
 * @param {() => void} actions.cancelMobileDrag - Отменяет незавершённый мобильный жест.
 * @param {(task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => void} actions.handleTaskKeys - Обрабатывает клавиатурные команды для строки задачи.
 * @param {(task: TaskNode) => void} actions.submitEdit - Сохраняет изменения формы задачи.
 * @param {() => void} actions.cancelEdit - Отменяет редактирование задачи.
 * @param {string | null} actions.editTaskId - ID задачи, которая сейчас редактируется.
 * @param {string} actions.editTitle - Текущее значение поля названия задачи.
 * @param {string} actions.editPlacement - Текущий выбор проекта или секции формы редактирования.
 * @param {string | null} actions.subtaskParentId - ID родителя открытой формы подзадачи.
 * @param {string} actions.subtaskTitle - Текущее значение названия подзадачи.
 * @param {string | null} actions.draggingTaskId - ID задачи, которую сейчас перетаскивают.
 * @param {ActiveDragTarget | null} actions.activeDragTarget - Активная подсвеченная цель сброса.
 * @param {Array<{ value: string; label: string }>} actions.placementOptions - Варианты мест, доступные в форме перемещения задачи.
 * @param {(title: string) => void} actions.setEditTitle - Обновляет название в форме редактирования.
 * @param {(placement: string) => void} actions.setEditPlacement - Обновляет целевой проект/секцию формы редактирования.
 * @param {(title: string) => void} actions.setSubtaskTitle - Обновляет название новой подзадачи.
 * @param [depth]
 * @returns {ReactElement}
 */
export const renderTaskNodes = (
  tasks: Array<TaskNode>,
  actions: /**
   * Поля этой структуры:
   * - `toggleTask`: Переключает состояние завершения задачи.
   * - `startEditing`: Открывает редактирование названия и размещения задачи.
   * - `openDetails`: Открывает подробности задачи.
   * - `openContextMenu`: Открывает меню действий у указателя.
   * - `selectionMode`: Включает множественный режим выбора строк.
   * - `attachmentsEnabled`: Разрешена ли загрузка вложений в приложении.
   * - `selectedTaskIds`: Идентификаторы выбранных задач.
   * - `toggleTaskSelection`: Добавляет или убирает задачу из выбранных.
   * - `deleteTask`: Удаляет задачу и её потомков.
   * - `startSubtask`: Открывает форму подзадачи для указанной задачи.
   * - `submitSubtask`: Сохраняет вводимую подзадачу.
   * - `cancelSubtask`: Закрывает форму подзадачи без сохранения.
   * - `moveTaskOntoTask`: Обрабатывает HTML drag-and-drop сброс поверх задачи.
   * - `markDragTarget`: Отмечает позицию, на которую можно сбросить перетаскиваемую задачу.
   * - `clearDragTarget`: Снимает текущую подсветку места сброса.
   * - `finishDragging`: Завершает перетаскивание мышью.
   * - `startDragging`: Запускает перетаскивание мышью.
   * - `startMobileTaskDrag`: Запускает мобильное перетаскивание через Pointer Events.
   * - `moveMobileDrag`: Обновляет мобильную drop-zone при движении указателя.
   * - `finishMobileDrag`: Завершает мобильный жест и выполняет назначенное перемещение.
   * - `cancelMobileDrag`: Отменяет незавершённый мобильный жест.
   * - `handleTaskKeys`: Обрабатывает клавиатурные команды для строки задачи.
   * - `submitEdit`: Сохраняет изменения формы задачи.
   * - `cancelEdit`: Отменяет редактирование задачи.
   * - `editTaskId`: ID задачи, которая сейчас редактируется.
   * - `editTitle`: Текущее значение поля названия задачи.
   * - `editPlacement`: Текущий выбор проекта или секции формы редактирования.
   * - `subtaskParentId`: ID родителя открытой формы подзадачи.
   * - `subtaskTitle`: Текущее значение названия подзадачи.
   * - `draggingTaskId`: ID задачи, которую сейчас перетаскивают.
   * - `activeDragTarget`: Активная подсвеченная цель сброса.
   * - `placementOptions`: Варианты мест, доступные в форме перемещения задачи.
   * - `setEditTitle`: Обновляет название в форме редактирования.
   * - `setEditPlacement`: Обновляет целевой проект/секцию формы редактирования.
   * - `setSubtaskTitle`: Обновляет название новой подзадачи.
   */
  {
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
            /** Клик по строке меняет выбор только в режиме массовых действий. */
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
                  /** Escape закрывает встроенный редактор и не отправляет форму. */
                  event.preventDefault();
                  actions.cancelEdit();
                }
              }}
              onSubmit={(event) => {
                /** Запрещаем обычную навигацию формы и передаём сохранение action-хуку. */
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
                      /** Enter сохраняет название, а Shift+Enter позволяет перейти на новую строку. */
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
                  /** В режиме массового выбора заголовок не открывает боковую панель. */
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
              /** Создание подзадачи обрабатывается без перезагрузки страницы. */
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
                  /** Сохраняем подзадачу по Enter и оставляем Shift+Enter для текста. */
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
