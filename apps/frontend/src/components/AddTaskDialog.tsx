import { Plus, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { AutoGrowTextarea, DatePickerPanel, LabelPicker } from "./TaskFormFields";

/**
 * Values and setters for fields managed by the new task form.
 *
 * @typedef {Object} AddTaskDraft
 * @property {boolean} open - Whether the dialog is open.
 * @property {Dispatch<SetStateAction<boolean>>} setOpen - Updates the dialog visibility.
 * @property {string} title - Draft task title.
 * @property {Dispatch<SetStateAction<string>>} setTitle - Updates the task title.
 * @property {string} description - Draft task description.
 * @property {Dispatch<SetStateAction<string>>} setDescription - Updates the task description.
 * @property {Array<File>} files - Selected files.
 * @property {Dispatch<SetStateAction<Array<File>>>} setFiles - Updates the selected files.
 * @property {string} date - Selected calendar date.
 * @property {Dispatch<SetStateAction<string>>} setDate - Updates the selected date.
 * @property {boolean} datePickerOpen - Whether the due date picker is open.
 * @property {Dispatch<SetStateAction<boolean>>} setDatePickerOpen - Updates the date picker visibility.
 * @property {string} dateBeforePicker - Date selected before opening the picker.
 * @property {Dispatch<SetStateAction<string>>} setDateBeforePicker - Updates the saved date.
 * @property {Array<string>} labels - Selected labels.
 * @property {Dispatch<SetStateAction<Array<string>>>} setLabels - Updates the selected labels.
 * @property {string} labelInput - Draft label text.
 * @property {Dispatch<SetStateAction<string>>} setLabelInput - Updates the label input.
 * @property {boolean} showDescription - Whether to show the description field.
 * @property {Dispatch<SetStateAction<boolean>>} setShowDescription - Updates description field visibility.
 * @property {boolean} showDate - Whether to show the due date picker.
 * @property {Dispatch<SetStateAction<boolean>>} setShowDate - Updates due date picker visibility.
 * @property {boolean} showLabels - Whether to show the label picker.
 * @property {Dispatch<SetStateAction<boolean>>} setShowLabels - Updates label picker visibility.
 * @property {string} placement - Position in the tree or list.
 * @property {Dispatch<SetStateAction<string>>} setPlacement - Updates the task placement.
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
 * Dialog inputs, including application capabilities and form actions.
 *
 * @typedef {Object} AddTaskDialogProps
 * @property {AddTaskDraft} draft - Draft values entered by the user.
 * @property {boolean} attachmentsEnabled - Whether the application can upload and serve attachments.
 * @property {Array<string>} availableLabels - Labels available to assign to the task.
 * @property {Array<{ value: string; label: string }>} placementOptions - Available task placements.
 * @property {string} placementOptions.value - Placement identifier.
 * @property {string} placementOptions.label - Human-readable placement name.
 * @property {AddTaskDialogPropsOnSubmit} onSubmit - Submits the form.
 * @property {AddTaskDialogPropsPastedFiles} pastedFiles - Files pasted from the clipboard.
 * @property {AddTaskDialogPropsNotifyAttachedFiles} notifyAttachedFiles - Reports the selected files.
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
 * Renders the task creation form with a description, due date, labels, and files.
 *
 * @param {AddTaskDialogProps} parameter1
 * @returns The task creation dialog.
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
        /** Clicking inside the form must not close the dialog. */
        if (event.target === event.currentTarget) setAddTaskOpen(false);
      }}
    >
      <section
        className="add-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add task"
        onPasteCapture={(event) => {
          /** Accept clipboard files only when attachment support is enabled. */
          if (!attachmentsEnabled) return;
          const files = pastedFiles(event.clipboardData);
          if (files.length > 0) {
            event.preventDefault();
            /** Respect the remaining capacity so the form does not exceed the server limit. */
            const acceptedFiles = files.slice(0, Math.max(0, 10 - addTaskFiles.length));
            setAddTaskFiles([...addTaskFiles, ...acceptedFiles]);
            notifyAttachedFiles(acceptedFiles);
          }
        }}
        onKeyDown={(event) => {
          /** Escape does not close the main form while the nested date picker is open. */
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
                  /** Enter submits the form; Shift+Enter inserts a new line. */
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
