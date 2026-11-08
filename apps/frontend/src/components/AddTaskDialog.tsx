import { Plus, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { AutoGrowTextarea, DatePickerPanel, LabelPicker } from "./TaskFormFields";

type AddTaskDraft = Readonly<{
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  files: ReadonlyArray<File>;
  setFiles: Dispatch<SetStateAction<ReadonlyArray<File>>>;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  datePickerOpen: boolean;
  setDatePickerOpen: Dispatch<SetStateAction<boolean>>;
  dateBeforePicker: string;
  setDateBeforePicker: Dispatch<SetStateAction<string>>;
  labels: ReadonlyArray<string>;
  setLabels: Dispatch<SetStateAction<ReadonlyArray<string>>>;
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
}>;

type AddTaskDialogProps = Readonly<{
  draft: AddTaskDraft;
  attachmentsEnabled: boolean;
  availableLabels: ReadonlyArray<string>;
  placementOptions: ReadonlyArray<Readonly<{ value: string; label: string }>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  pastedFiles: (data: DataTransfer) => ReadonlyArray<File>;
  notifyAttachedFiles: (files: ReadonlyArray<File>) => void;
}>;

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
        if (event.target === event.currentTarget) setAddTaskOpen(false);
      }}
    >
      <section
        className="add-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add task"
        onPasteCapture={(event) => {
          if (!attachmentsEnabled) return;
          const files = pastedFiles(event.clipboardData);
          if (files.length > 0) {
            event.preventDefault();
            const acceptedFiles = files.slice(0, Math.max(0, 10 - addTaskFiles.length));
            setAddTaskFiles(Object.freeze([...addTaskFiles, ...acceptedFiles]));
            notifyAttachedFiles(acceptedFiles);
          }
        }}
        onKeyDown={(event) => {
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
                  setAddTaskLabels(Object.freeze([]));
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
                    setAddTaskFiles(Object.freeze([...addTaskFiles, ...acceptedFiles]));
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
                      setAddTaskFiles(
                        Object.freeze(addTaskFiles.filter((_, itemIndex) => index !== itemIndex)),
                      )
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
