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

/** Положение перетаскиваемой задачи относительно другой строки дерева. */
type DragPlacement = "before" | "inside" | "after" | "outdent";

/** Активная задача и вычисленное место, подсвечиваемое во время drag-and-drop. */
export type ActiveDragTarget = {
  /** Идентификатор задачи, над которой находится курсор. */
  taskId: TaskId;
  /** Сторона сброса или вложение внутрь задачи. */
  placement: DragPlacement;
};

/** Рекурсивно отображает дерево задач и связывает элементы с действиями workspace. */
export const renderTaskNodes = (
  tasks: Array<TaskNode>,
  actions: {
    /** Переключает состояние завершения задачи. */
    toggleTask: (task: TaskNode) => void;
    /** Открывает редактирование названия и размещения задачи. */
    startEditing: (task: TaskNode) => void;
    /** Открывает подробности задачи. */
    openDetails: (task: TaskNode) => void;
    /** Открывает меню действий у указателя. */
    openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void;
    /** Включает множественный режим выбора строк. */
    selectionMode: boolean;
    /** Разрешена ли загрузка вложений в приложении. */
    attachmentsEnabled: boolean;
    /** Идентификаторы выбранных задач. */
    selectedTaskIds: Array<TaskId>;
    /** Добавляет или убирает задачу из выбранных. */
    toggleTaskSelection: (task: TaskNode) => void;
    /** Удаляет задачу и её потомков. */
    deleteTask: (task: TaskNode) => void;
    /** Открывает форму подзадачи для указанной задачи. */
    startSubtask: (task: TaskNode) => void;
    /** Сохраняет вводимую подзадачу. */
    submitSubtask: (task: TaskNode) => void;
    /** Закрывает форму подзадачи без сохранения. */
    cancelSubtask: () => void;
    /** Обрабатывает HTML drag-and-drop сброс поверх задачи. */
    moveTaskOntoTask: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    /** Отмечает позицию, на которую можно сбросить перетаскиваемую задачу. */
    markDragTarget: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    /** Снимает текущую подсветку места сброса. */
    clearDragTarget: () => void;
    /** Завершает перетаскивание мышью. */
    finishDragging: () => void;
    /** Запускает перетаскивание мышью. */
    startDragging: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    /** Запускает мобильное перетаскивание через Pointer Events. */
    startMobileTaskDrag: (task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => void;
    /** Обновляет мобильную drop-zone при движении указателя. */
    moveMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    /** Завершает мобильный жест и выполняет назначенное перемещение. */
    finishMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    /** Отменяет незавершённый мобильный жест. */
    cancelMobileDrag: () => void;
    /** Обрабатывает клавиатурные команды для строки задачи. */
    handleTaskKeys: (task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => void;
    /** Сохраняет изменения формы задачи. */
    submitEdit: (task: TaskNode) => void;
    /** Отменяет редактирование задачи. */
    cancelEdit: () => void;
    /** ID задачи, которая сейчас редактируется. */
    editTaskId: string | null;
    /** Текущее значение поля названия задачи. */
    editTitle: string;
    /** Текущий выбор проекта или секции формы редактирования. */
    editPlacement: string;
    /** ID родителя открытой формы подзадачи. */
    subtaskParentId: string | null;
    /** Текущее значение названия подзадачи. */
    subtaskTitle: string;
    /** ID задачи, которую сейчас перетаскивают. */
    draggingTaskId: string | null;
    /** Активная подсвеченная цель сброса. */
    activeDragTarget: ActiveDragTarget | null;
    /** Варианты мест, доступные в форме перемещения задачи. */
    placementOptions: Array<{ value: string; label: string }>;
    /** Обновляет название в форме редактирования. */
    setEditTitle: (title: string) => void;
    /** Обновляет целевой проект/секцию формы редактирования. */
    setEditPlacement: (placement: string) => void;
    /** Обновляет название новой подзадачи. */
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
            // Клик по строке меняет выбор только в режиме массовых действий.
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
                  // Escape закрывает встроенный редактор и не отправляет форму.
                  event.preventDefault();
                  actions.cancelEdit();
                }
              }}
              onSubmit={(event) => {
                // Запрещаем обычную навигацию формы и передаём сохранение action-хуку.
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
                      // Enter сохраняет название, а Shift+Enter позволяет перейти на новую строку.
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
                  // В режиме массового выбора заголовок не открывает боковую панель.
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
              // Создание подзадачи обрабатывается без перезагрузки страницы.
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
                  // Сохраняем подзадачу по Enter и оставляем Shift+Enter для текста.
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
