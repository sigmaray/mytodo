import { Plus, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { AutoGrowTextarea, DatePickerPanel, LabelPicker } from "./TaskFormFields";

/**
 * Значения и setters полей, которыми управляет форма новой задачи.
 *
 * @typedef {Object} AddTaskDraft
 * @property {boolean} open - Признак или настройка «открытие».
 * @property {Dispatch<SetStateAction<boolean>>} setOpen - Обновляет значение соответствующего состояния.
 * @property {string} title - Данные «заголовок», используемые типом «AddTaskDraft».
 * @property {Dispatch<SetStateAction<string>>} setTitle - Обновляет значение соответствующего состояния.
 * @property {string} description - Данные «описание», используемые типом «AddTaskDraft».
 * @property {Dispatch<SetStateAction<string>>} setDescription - Обновляет значение соответствующего состояния.
 * @property {Array<File>} files - Список выбранных файлов.
 * @property {Dispatch<SetStateAction<Array<File>>>} setFiles - Обновляет значение соответствующего состояния.
 * @property {string} date - Дата календарного дня.
 * @property {Dispatch<SetStateAction<string>>} setDate - Обновляет значение соответствующего состояния.
 * @property {boolean} datePickerOpen - Признак, что календарь выбора срока открыт.
 * @property {Dispatch<SetStateAction<boolean>>} setDatePickerOpen - Обновляет значение соответствующего состояния.
 * @property {string} dateBeforePicker - Дата, выбранная до открытия календаря.
 * @property {Dispatch<SetStateAction<string>>} setDateBeforePicker - Обновляет значение соответствующего состояния.
 * @property {Array<string>} labels - Список метки.
 * @property {Dispatch<SetStateAction<Array<string>>>} setLabels - Обновляет значение соответствующего состояния.
 * @property {string} labelInput - Черновик названия метки.
 * @property {Dispatch<SetStateAction<string>>} setLabelInput - Обновляет значение соответствующего состояния.
 * @property {boolean} showDescription - Признак отображения поля описания.
 * @property {Dispatch<SetStateAction<boolean>>} setShowDescription - Обновляет значение соответствующего состояния.
 * @property {boolean} showDate - Признак отображения выбора срока.
 * @property {Dispatch<SetStateAction<boolean>>} setShowDate - Обновляет значение соответствующего состояния.
 * @property {boolean} showLabels - Признак отображения выбора меток.
 * @property {Dispatch<SetStateAction<boolean>>} setShowLabels - Обновляет значение соответствующего состояния.
 * @property {string} placement - Позиция элемента в дереве или списке.
 * @property {Dispatch<SetStateAction<string>>} setPlacement - Обновляет значение соответствующего состояния.
 */
type AddTaskDraft = {
  open: boolean;

  setOpen: Dispatch<SetStateAction<boolean>>;

  title: string;

  setTitle: Dispatch<SetStateAction<string>>;

  description: string;

  setDescription: Dispatch<SetStateAction<string>>;

  files: Array<File>;

  setFiles: Dispatch<SetStateAction<Array<File>>>;

  date: string;

  setDate: Dispatch<SetStateAction<string>>;

  datePickerOpen: boolean;

  setDatePickerOpen: Dispatch<SetStateAction<boolean>>;

  dateBeforePicker: string;

  setDateBeforePicker: Dispatch<SetStateAction<string>>;

  labels: Array<string>;

  setLabels: Dispatch<SetStateAction<Array<string>>>;

  labelInput: string;

  setLabelInput: Dispatch<SetStateAction<string>>;

  showDescription: boolean;

  setShowDescription: Dispatch<SetStateAction<boolean>>;

  showDate: boolean;

  setShowDate: Dispatch<SetStateAction<boolean>>;

  showLabels: boolean;

  setShowLabels: Dispatch<SetStateAction<boolean>>;

  placement: string;

  setPlacement: Dispatch<SetStateAction<string>>;
};

/**
 * @callback AddTaskDialogPropsOnSubmit
 * @param {FormEvent<HTMLFormElement>} event
 * @returns {void | Promise<void>}
 */

/**
 * @callback AddTaskDialogPropsPastedFiles
 * @param {DataTransfer} data
 * @returns {Array<File>}
 */

/**
 * @callback AddTaskDialogPropsNotifyAttachedFiles
 * @param {Array<File>} files
 * @returns {void}
 */
/**
 * Входные данные диалога, включая возможности приложения и действия формы.
 *
 * @typedef {Object} AddTaskDialogProps
 * @property {AddTaskDraft} draft - Черновик вводимых пользователем данных.
 * @property {boolean} attachmentsEnabled - Разрешено ли приложению загружать и выдавать вложения.
 * @property {Array<string>} availableLabels - Метки, доступные для назначения задаче.
 * @property {Array<{ value: string; label: string }>} placementOptions - Список позиция options.
 * @property {string} placementOptions.value - Данные «позиция options value», используемые типом «AddTaskDialogProps».
 * @property {string} placementOptions.label - Данные «позиция options метка», используемые типом «AddTaskDialogProps».
 * @property {AddTaskDialogPropsOnSubmit} onSubmit - Отправляет форму.
 * @property {AddTaskDialogPropsPastedFiles} pastedFiles - Файлы, вставленные из буфера обмена.
 * @property {AddTaskDialogPropsNotifyAttachedFiles} notifyAttachedFiles - Сообщает о выбранных файлах.
 */
type AddTaskDialogProps = {
  draft: AddTaskDraft;

  attachmentsEnabled: boolean;

  availableLabels: Array<string>;

  placementOptions: Array<{ value: string; label: string }>;

  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;

  pastedFiles: (data: DataTransfer) => Array<File>;

  notifyAttachedFiles: (files: Array<File>) => void;
};

/**
 * Отображает форму создания задачи с описанием, сроком, метками и файлами.
 *
 * @param {AddTaskDialogProps} parameter1
 * @returns Результат выполнения функции.
 */
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
        /** Клик внутри формы не должен закрывать диалог. */
        if (event.target === event.currentTarget) setAddTaskOpen(false);
      }}
    >
      <section
        className="add-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add task"
        onPasteCapture={(event) => {
          /** Файлы из буфера обмена принимаются только при включённой поддержке вложений. */
          if (!attachmentsEnabled) return;
          const files = pastedFiles(event.clipboardData);
          if (files.length > 0) {
            event.preventDefault();
            /** Ограничиваем буфер оставшимся лимитом, чтобы форма не превысила серверный максимум. */
            const acceptedFiles = files.slice(0, Math.max(0, 10 - addTaskFiles.length));
            setAddTaskFiles([...addTaskFiles, ...acceptedFiles]);
            notifyAttachedFiles(acceptedFiles);
          }
        }}
        onKeyDown={(event) => {
          /** Escape не закрывает основную форму, пока открыт вложенный выбор даты. */
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
                  /** Enter отправляет форму, а Shift+Enter вставляет перенос строки. */
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
