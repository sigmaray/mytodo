import { Plus, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { AutoGrowTextarea, DatePickerPanel, LabelPicker } from "./TaskFormFields";

/** Значения и setters полей, которыми управляет форма новой задачи. */
type AddTaskDraft = {
  /** Показывает, открыт ли диалог создания задачи. */
  open: boolean;
  /** Управляет видимостью диалога. */
  setOpen: Dispatch<SetStateAction<boolean>>;
  /** Черновик названия новой задачи. */
  title: string;
  /** Обновляет черновик названия. */
  setTitle: Dispatch<SetStateAction<string>>;
  /** Черновик описания задачи. */
  description: string;
  /** Обновляет черновик описания. */
  setDescription: Dispatch<SetStateAction<string>>;
  /** Файлы, приложенные к создаваемой задаче. */
  files: Array<File>;
  /** Обновляет список выбранных файлов. */
  setFiles: Dispatch<SetStateAction<Array<File>>>;
  /** Черновик срока задачи. */
  date: string;
  /** Обновляет срок задачи. */
  setDate: Dispatch<SetStateAction<string>>;
  /** Открыт ли календарь выбора срока. */
  datePickerOpen: boolean;
  /** Управляет открытием календаря. */
  setDatePickerOpen: Dispatch<SetStateAction<boolean>>;
  /** Значение срока перед временным открытием выбора даты. */
  dateBeforePicker: string;
  /** Сохраняет предыдущее значение срока для отмены выбора. */
  setDateBeforePicker: Dispatch<SetStateAction<string>>;
  /** Выбранные метки новой задачи. */
  labels: Array<string>;
  /** Обновляет выбранные метки. */
  setLabels: Dispatch<SetStateAction<Array<string>>>;
  /** Текущий текст поля добавления метки. */
  labelInput: string;
  /** Обновляет текст поля метки. */
  setLabelInput: Dispatch<SetStateAction<string>>;
  /** Раскрыто ли поле описания. */
  showDescription: boolean;
  /** Управляет раскрытием описания. */
  setShowDescription: Dispatch<SetStateAction<boolean>>;
  /** Раскрыто ли поле срока. */
  showDate: boolean;
  /** Управляет раскрытием срока. */
  setShowDate: Dispatch<SetStateAction<boolean>>;
  /** Раскрыт ли редактор меток. */
  showLabels: boolean;
  /** Управляет раскрытием редактора меток. */
  setShowLabels: Dispatch<SetStateAction<boolean>>;
  /** Строковый идентификатор выбранного Inbox/project/section. */
  placement: string;
  /** Меняет место размещения новой задачи. */
  setPlacement: Dispatch<SetStateAction<string>>;
};

/** Входные данные диалога, включая возможности приложения и действия формы. */
type AddTaskDialogProps = {
  /** Текущие значения полей и функции для их изменения. */
  draft: AddTaskDraft;
  /** Разрешена ли отправка вложений вместе с задачей. */
  attachmentsEnabled: boolean;
  /** Метки, уже встречавшиеся у задач пользователя. */
  availableLabels: Array<string>;
  /** Список мест, куда можно поместить новую задачу. */
  placementOptions: Array<{ value: string; label: string }>;
  /** Валидирует форму и создаёт задачу. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  /** Извлекает поддерживаемые файлы из события вставки. */
  pastedFiles: (data: DataTransfer) => Array<File>;
  /** Показывает уведомление о добавленных файлах. */
  notifyAttachedFiles: (files: Array<File>) => void;
};

/** Отображает форму создания задачи с описанием, сроком, метками и файлами. */
export const AddTaskDialog = ({
  draft,
  attachmentsEnabled,
  availableLabels,
  placementOptions,
  onSubmit,
  pastedFiles,
  notifyAttachedFiles,
}: AddTaskDialogProps) => {
  const {
    open: addTaskOpen,
    setOpen: setAddTaskOpen,
    title: addTaskTitle,
    setTitle: setAddTaskTitle,
    description: addTaskDescription,
    setDescription: setAddTaskDescription,
    files: addTaskFiles,
    setFiles: setAddTaskFiles,
    date: addTaskDate,
    setDate: setAddTaskDate,
    datePickerOpen: addTaskDatePickerOpen,
    setDatePickerOpen: setAddTaskDatePickerOpen,
    dateBeforePicker: addTaskDateBeforePicker,
    setDateBeforePicker: setAddTaskDateBeforePicker,
    labels: addTaskLabels,
    setLabels: setAddTaskLabels,
    labelInput: addTaskLabelInput,
    setLabelInput: setAddTaskLabelInput,
    showDescription: showAddTaskDescription,
    setShowDescription: setShowAddTaskDescription,
    showDate: showAddTaskDate,
    setShowDate: setShowAddTaskDate,
    showLabels: showAddTaskLabels,
    setShowLabels: setShowAddTaskLabels,
    placement: addTaskPlacement,
    setPlacement: setAddTaskPlacement,
  } = draft;
  if (!addTaskOpen) return null;
  return (
    <div
      className="task-details-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        // Клик внутри формы не должен закрывать диалог.
        if (event.target === event.currentTarget) setAddTaskOpen(false);
      }}
    >
      <section
        className="add-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add task"
        onPasteCapture={(event) => {
          // Файлы из буфера обмена принимаются только при включённой поддержке вложений.
          if (!attachmentsEnabled) return;
          const files = pastedFiles(event.clipboardData);
          if (files.length > 0) {
            event.preventDefault();
            // Ограничиваем буфер оставшимся лимитом, чтобы форма не превысила серверный максимум.
            const acceptedFiles = files.slice(0, Math.max(0, 10 - addTaskFiles.length));
            setAddTaskFiles([...addTaskFiles, ...acceptedFiles]);
            notifyAttachedFiles(acceptedFiles);
          }
        }}
        onKeyDown={(event) => {
          // Escape не закрывает основную форму, пока открыт вложенный выбор даты.
          if (event.key === "Escape" && !addTaskDatePickerOpen) setAddTaskOpen(false);
        }}
      >
        <header>
          <h2>Add task</h2>
          <button type="button" aria-label="Close add task" onClick={() => setAddTaskOpen(false)}>
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <label>
            Task name
            <AutoGrowTextarea
              autoFocus
              ariaLabel="New task title"
              value={addTaskTitle}
              onChange={setAddTaskTitle}
              required
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  // Enter отправляет форму, а Shift+Enter вставляет перенос строки.
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </label>
          <label
            className={`add-task-optional${!addTaskDescription && !showAddTaskDescription ? " add-task-optional-hidden" : ""}`}
          >
            <div className="add-task-mobile-heading">
              <span>Description</span>
              <button
                type="button"
                className="add-task-mobile-collapse"
                aria-label="Clear description and hide section"
                onClick={() => {
                  setAddTaskDescription("");
                  setShowAddTaskDescription(false);
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <AutoGrowTextarea
              autoFocus={showAddTaskDescription && !addTaskDescription}
              ariaLabel="New task description"
              value={addTaskDescription}
              onChange={setAddTaskDescription}
            />
          </label>
          <label>
            Project or section
            <select
              aria-label="Add task project"
              value={addTaskPlacement}
              onChange={(event) => setAddTaskPlacement(event.target.value)}
            >
              {placementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="add-task-mobile-shortcuts">
            {!addTaskDescription && !showAddTaskDescription ? (
              <button type="button" onClick={() => setShowAddTaskDescription(true)}>
                <Plus size={15} aria-hidden="true" />
                Description
              </button>
            ) : null}
            {!addTaskDate && !showAddTaskDate ? (
              <button
                type="button"
                onClick={() => {
                  setShowAddTaskDate(true);
                  setAddTaskDateBeforePicker(addTaskDate);
                  setAddTaskDatePickerOpen(true);
                }}
              >
                <Plus size={15} aria-hidden="true" />
                Date
              </button>
            ) : null}
            {!addTaskLabels.length && !showAddTaskLabels ? (
              <button type="button" onClick={() => setShowAddTaskLabels(true)}>
                <Plus size={15} aria-hidden="true" />
                Labels
              </button>
            ) : null}
          </div>
          <label
            className={`add-task-optional${!addTaskDate && !showAddTaskDate ? " add-task-optional-hidden" : ""}`}
          >
            <div className="add-task-mobile-heading">
              <span>Date</span>
              <button
                type="button"
                className="add-task-mobile-collapse"
                aria-label="Remove date and hide section"
                onClick={() => {
                  setAddTaskDate("");
                  setShowAddTaskDate(false);
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            {addTaskDate ? (
              <div className="task-detail-meta-value">
                <button
                  type="button"
                  className="task-detail-date"
                  onClick={() => {
                    setAddTaskDateBeforePicker(addTaskDate);
                    setAddTaskDatePickerOpen(true);
                  }}
                >
                  {new Date(`${addTaskDate}T00:00:00`).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </button>
                <button
                  type="button"
                  aria-label="Remove task date"
                  className="add-task-desktop-remove-date"
                  onClick={() => setAddTaskDate("")}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Add date"
                className="btn-primary add-task-date-button"
                onClick={() => {
                  setAddTaskDateBeforePicker(addTaskDate);
                  setAddTaskDatePickerOpen(true);
                }}
              >
                ＋ Add date
              </button>
            )}
          </label>
          <div
            className={`add-task-labels add-task-optional${!addTaskLabels.length && !showAddTaskLabels ? " add-task-optional-hidden" : ""}`}
          >
            <div className="add-task-mobile-heading">
              <span className="form-field-label">Labels</span>
              <button
                type="button"
                className="add-task-mobile-collapse"
                aria-label="Remove labels and hide section"
                onClick={() => {
                  setAddTaskLabels([]);
                  setAddTaskLabelInput("");
                  setShowAddTaskLabels(false);
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <LabelPicker
              autoFocus={showAddTaskLabels && !addTaskLabels.length}
              selected={addTaskLabels}
              options={availableLabels}
              inputLabel="New task labels"
              inputValue={addTaskLabelInput}
              onInputChange={setAddTaskLabelInput}
              onChange={setAddTaskLabels}
            />
          </div>
          {attachmentsEnabled ? (
            <section className="add-task-attachments">
              <label className="attachment-picker">
                Attach files
                <input
                  aria-label="Attach files to new task"
                  type="file"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    const acceptedFiles = files.slice(0, Math.max(0, 10 - addTaskFiles.length));
                    setAddTaskFiles([...addTaskFiles, ...acceptedFiles]);
                    notifyAttachedFiles(acceptedFiles);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {addTaskFiles.map((file, index) => (
                <span className="attachment-draft" key={`${file.name}-${file.lastModified}-${index}`}>
                  {file.name}
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setAddTaskFiles(addTaskFiles.filter((_, itemIndex) => index !== itemIndex))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </section>
          ) : null}
          <div>
            <button type="button" onClick={() => setAddTaskOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add task
            </button>
          </div>
        </form>
        {addTaskDatePickerOpen ? (
          <div className="task-date-picker-backdrop">
            <section
              className="task-date-picker"
              role="dialog"
              aria-modal="true"
              aria-label="Add date"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setAddTaskDate(addTaskDateBeforePicker);
                  setAddTaskDatePickerOpen(false);
                  if (!addTaskDateBeforePicker) setShowAddTaskDate(false);
                }
              }}
            >
              <h3>Add date</h3>
              <DatePickerPanel
                autoFocus
                inputLabel="New task date"
                value={addTaskDate}
                onChange={setAddTaskDate}
              />
              <div className="task-date-picker-actions">
                <button
                  type="button"
                  onClick={() => {
                    setAddTaskDate(addTaskDateBeforePicker);
                    setAddTaskDatePickerOpen(false);
                    if (!addTaskDateBeforePicker) setShowAddTaskDate(false);
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={() => setAddTaskDatePickerOpen(false)}>
                  Set date
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
};
