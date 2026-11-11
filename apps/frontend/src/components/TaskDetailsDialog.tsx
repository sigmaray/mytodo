import type { QueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, Section, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import { CalendarDays, Edit3, Plus, X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ApplicationApi } from "../api";
import { isTaskDueToday, taskDueDateTone } from "../dateUtils";
import { taskQueryKey } from "../queryKeys";
import {
  createPlacementOptions,
  inboxPlacement,
  parsePlacement,
  projectPlacement,
  sectionPlacement,
} from "../taskAppUtils";
import { TaskCommentsPanel } from "./TaskCommentsPanel";
import { AutoGrowTextarea, DatePickerPanel, LabelPicker } from "./TaskFormFields";

type TaskDetailsPatch = Parameters<ApplicationApi["updateTask"]>[1];

type TaskDetailsDialogProps = Readonly<{
  api: ApplicationApi;
  queryClient: QueryClient;
  attachmentsEnabled: boolean;
  selectedDetailsTask: TaskNode | null;
  selectedDetailsProject: Project | null;
  selectedDetailsSection: Section | null;
  selectedDetailsParent: TaskNode | null;
  activeProjects: ReadonlyArray<Project>;
  allSections: ReadonlyArray<Section>;
  availableLabels: ReadonlyArray<string>;
  detailTitle: string;
  detailDescription: string;
  detailDueDate: string;
  detailLabelInput: string;
  detailSaveStatus: string;
  detailProjectId: ProjectId | null;
  detailSectionId: SectionId | null;
  editingDetailField: "title" | "description" | null;
  datePickerOpen: boolean;
  showMobileLabels: boolean;
  showMobileComments: boolean;
  showMobileDate: boolean;
  showMobileSubtasks: boolean;
  detailComment: string;
  detailCommentFiles: ReadonlyArray<File>;
  detailSubtask: string;
  editingCommentId: string | null;
  editingCommentBody: string;
  subtasksSectionRef: RefObject<HTMLElement | null>;
  setDetailsTaskId: Dispatch<SetStateAction<TaskId | null>>;
  setDetailTitle: Dispatch<SetStateAction<string>>;
  setDetailDescription: Dispatch<SetStateAction<string>>;
  setDetailDueDate: Dispatch<SetStateAction<string>>;
  setDetailLabelInput: Dispatch<SetStateAction<string>>;
  setDetailSaveStatus: Dispatch<SetStateAction<string>>;
  setDetailProjectId: Dispatch<SetStateAction<ProjectId | null>>;
  setDetailSectionId: Dispatch<SetStateAction<SectionId | null>>;
  setEditingDetailField: Dispatch<SetStateAction<"title" | "description" | null>>;
  setDatePickerOpen: Dispatch<SetStateAction<boolean>>;
  setShowMobileLabels: Dispatch<SetStateAction<boolean>>;
  setShowMobileComments: Dispatch<SetStateAction<boolean>>;
  setShowMobileDate: Dispatch<SetStateAction<boolean>>;
  setShowMobileSubtasks: Dispatch<SetStateAction<boolean>>;
  setDetailComment: Dispatch<SetStateAction<string>>;
  setDetailCommentFiles: Dispatch<SetStateAction<ReadonlyArray<File>>>;
  setDetailSubtask: Dispatch<SetStateAction<string>>;
  setEditingCommentId: Dispatch<SetStateAction<string | null>>;
  setEditingCommentBody: Dispatch<SetStateAction<string>>;
  confirmDeletion: (message: string) => boolean;
  saveTaskDetails: (patch: TaskDetailsPatch) => Promise<boolean>;
  removeCommentAttachment: (commentId: string, attachmentId: string) => Promise<void>;
  closeMobileLabels: () => Promise<void>;
  closeMobileComments: () => Promise<void>;
  closeMobileSubtasks: () => Promise<void>;
  openDetails: (task: TaskNode) => void;
  notifyAttachedFiles: (files: ReadonlyArray<File>) => void;
  pastedFiles: (clipboardData: DataTransfer) => ReadonlyArray<File>;
}>;

export const TaskDetailsDialog = (props: TaskDetailsDialogProps) => {
  const {
    api,
    queryClient,
    attachmentsEnabled,
    selectedDetailsTask,
    selectedDetailsProject,
    selectedDetailsSection,
    selectedDetailsParent,
    activeProjects,
    allSections,
    availableLabels,
    detailTitle,
    detailDescription,
    detailDueDate,
    detailLabelInput,
    detailSaveStatus,
    detailProjectId,
    detailSectionId,
    editingDetailField,
    datePickerOpen,
    showMobileLabels,
    showMobileComments,
    showMobileDate,
    showMobileSubtasks,
    detailComment,
    detailCommentFiles,
    detailSubtask,
    editingCommentId,
    editingCommentBody,
    subtasksSectionRef,
    setDetailsTaskId,
    setDetailTitle,
    setDetailDescription,
    setDetailDueDate,
    setDetailLabelInput,
    setDetailSaveStatus,
    setDetailProjectId,
    setDetailSectionId,
    setEditingDetailField,
    setDatePickerOpen,
    setShowMobileLabels,
    setShowMobileComments,
    setShowMobileDate,
    setShowMobileSubtasks,
    setDetailComment,
    setDetailCommentFiles,
    setDetailSubtask,
    setEditingCommentId,
    setEditingCommentBody,
    confirmDeletion,
    saveTaskDetails,
    removeCommentAttachment,
    closeMobileLabels,
    closeMobileComments,
    closeMobileSubtasks,
    openDetails,
    notifyAttachedFiles,
    pastedFiles,
  } = props;
  return (
    <>
      {selectedDetailsTask !== null ? (
        <div
          className="task-details-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailsTaskId(null);
          }}
        >
          <section
            className="task-details-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Task details: ${selectedDetailsTask.title}`}
            onPasteCapture={(event) => {
              if (!attachmentsEnabled) return;
              const files = pastedFiles(event.clipboardData);
              if (files.length > 0) {
                event.preventDefault();
                const acceptedFiles = files.slice(0, Math.max(0, 10 - detailCommentFiles.length));
                setDetailCommentFiles(Object.freeze([...detailCommentFiles, ...acceptedFiles]));
                notifyAttachedFiles(acceptedFiles);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && editingDetailField === null && !datePickerOpen)
                setDetailsTaskId(null);
            }}
          >
            <header className="task-details-header">
              <div className="task-details-header-path">
                <a
                  href={
                    selectedDetailsProject === null
                      ? "/"
                      : `/?project=${encodeURIComponent(selectedDetailsProject.id)}`
                  }
                >
                  {selectedDetailsProject?.title ?? "Inbox"}
                </a>
                {selectedDetailsSection !== null ? (
                  <>
                    <span aria-hidden="true">/</span>
                    <span>{selectedDetailsSection.title}</span>
                  </>
                ) : null}
                {selectedDetailsParent !== null ? (
                  <>
                    <span aria-hidden="true">/</span>
                    <a href={`/?task=${encodeURIComponent(selectedDetailsParent.id)}`}>
                      {selectedDetailsParent.title}
                    </a>
                  </>
                ) : null}
                <span aria-hidden="true">/</span>
                <strong>{selectedDetailsTask.title}</strong>
              </div>
              <div>
                <button type="button" aria-label="Close task details" onClick={() => setDetailsTaskId(null)}>
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="task-details-layout">
              <div className="task-details-main">
                <div className="task-detail-editable">
                  {editingDetailField === "title" ? (
                    <div className="task-detail-editor">
                      <AutoGrowTextarea
                        autoFocus
                        ariaLabel="Edit task title"
                        value={detailTitle}
                        onChange={setDetailTitle}
                        onKeyDown={async (event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            setDetailTitle(selectedDetailsTask.title);
                            setEditingDetailField(null);
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            const value = detailTitle.trim();
                            if (value && (await saveTaskDetails({ title: value })))
                              setEditingDetailField(null);
                          }
                        }}
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setDetailTitle(selectedDetailsTask.title);
                            setEditingDetailField(null);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={async () => {
                            const value = detailTitle.trim();
                            if (value && (await saveTaskDetails({ title: value })))
                              setEditingDetailField(null);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="task-detail-title-display"
                      aria-label="Edit task title"
                      onClick={() => {
                        setDetailTitle(selectedDetailsTask.title);
                        setEditingDetailField("title");
                      }}
                    >
                      <span>{selectedDetailsTask.title}</span>
                      <Edit3 size={17} aria-hidden="true" />
                    </button>
                  )}
                  {editingDetailField === "description" ? (
                    <div className="task-detail-editor">
                      <AutoGrowTextarea
                        autoFocus
                        ariaLabel="Edit task description"
                        value={detailDescription}
                        onChange={setDetailDescription}
                        onKeyDown={async (event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            setDetailDescription(selectedDetailsTask.description);
                            setEditingDetailField(null);
                          }
                          if (event.key === "Enter" && event.ctrlKey) {
                            event.preventDefault();
                            if (await saveTaskDetails({ description: detailDescription }))
                              setEditingDetailField(null);
                          }
                        }}
                      />
                      <small className="editor-hint">Press Ctrl+Enter to save.</small>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setDetailDescription(selectedDetailsTask.description);
                            setEditingDetailField(null);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={async () => {
                            if (await saveTaskDetails({ description: detailDescription }))
                              setEditingDetailField(null);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="task-detail-description-display"
                      aria-label="Edit task description"
                      onClick={() => {
                        setDetailDescription(selectedDetailsTask.description);
                        setEditingDetailField("description");
                      }}
                    >
                      {selectedDetailsTask.description || "Add description"}
                    </button>
                  )}
                </div>
                <section
                  ref={subtasksSectionRef}
                  id="task-subtasks-section"
                  className={`card border task-subtasks-card${selectedDetailsTask.children.length === 0 && !showMobileSubtasks ? " task-subtasks-hidden" : " task-subtasks-open"}`}
                  aria-labelledby="task-subtasks-title"
                >
                  <div className="card-header bg-light">
                    <strong id="task-subtasks-title">Subtasks</strong>
                    <span className="text-muted">
                      {selectedDetailsTask.children.filter((child) => child.completed).length}/
                      {selectedDetailsTask.children.length}
                    </span>
                    <button
                      type="button"
                      className="task-details-mobile-collapse"
                      aria-label="Delete all subtasks and hide section"
                      onClick={() => void closeMobileSubtasks()}
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="card-body task-subtasks-body">
                    {selectedDetailsTask.children.map((child) => (
                      <div className="details-subtask-row" key={child.id}>
                        <button type="button" className="details-subtask" onClick={() => openDetails(child)}>
                          {child.title}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete subtask ${child.title}`}
                          onClick={async () => {
                            if (!confirmDeletion(`Delete subtask “${child.title}” and its descendants?`))
                              return;
                            await api.deleteTask(child.id);
                            await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    <div className="details-subtask-add">
                      <AutoGrowTextarea
                        autoFocus={showMobileSubtasks && selectedDetailsTask.children.length === 0}
                        ariaLabel="New subtask title"
                        value={detailSubtask}
                        onChange={setDetailSubtask}
                        onKeyDown={async (event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            const title = detailSubtask.trim();
                            if (!title) return;
                            await api.createTask(
                              title,
                              selectedDetailsTask.projectId,
                              selectedDetailsTask.sectionId,
                              selectedDetailsTask.id,
                            );
                            setDetailSubtask("");
                            await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                          }
                        }}
                        placeholder="Add subtask"
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={async () => {
                          const title = detailSubtask.trim();
                          if (!title) return;
                          await api.createTask(
                            title,
                            selectedDetailsTask.projectId,
                            selectedDetailsTask.sectionId,
                            selectedDetailsTask.id,
                          );
                          setDetailSubtask("");
                          await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </section>
                <TaskCommentsPanel
                  task={selectedDetailsTask}
                  api={api}
                  attachmentsEnabled={attachmentsEnabled}
                  showMobileComments={showMobileComments}
                  onHide={closeMobileComments}
                  editingCommentId={editingCommentId}
                  setEditingCommentId={setEditingCommentId}
                  editingCommentBody={editingCommentBody}
                  setEditingCommentBody={setEditingCommentBody}
                  detailComment={detailComment}
                  setDetailComment={setDetailComment}
                  detailCommentFiles={detailCommentFiles}
                  setDetailCommentFiles={setDetailCommentFiles}
                  removeCommentAttachment={removeCommentAttachment}
                  confirmDeletion={confirmDeletion}
                  notifyAttachedFiles={notifyAttachedFiles}
                />
              </div>
              <aside className="task-details-sidebar">
                <div className="task-details-mobile-shortcuts">
                  {!selectedDetailsTask.labels.length && !showMobileLabels ? (
                    <button type="button" onClick={() => setShowMobileLabels(true)}>
                      <Plus size={15} aria-hidden="true" />
                      Labels
                    </button>
                  ) : null}
                  {!detailDueDate && !showMobileDate ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileDate(true);
                        setDatePickerOpen(true);
                      }}
                    >
                      <Plus size={15} aria-hidden="true" />
                      Date
                    </button>
                  ) : null}
                  {selectedDetailsTask.children.length === 0 && !showMobileSubtasks ? (
                    <button
                      type="button"
                      aria-expanded="false"
                      aria-controls="task-subtasks-section"
                      onClick={() => setShowMobileSubtasks(true)}
                    >
                      <Plus size={15} aria-hidden="true" />
                      Subtasks
                    </button>
                  ) : null}
                  {!selectedDetailsTask.comments.length && !showMobileComments ? (
                    <button type="button" onClick={() => setShowMobileComments(true)}>
                      <Plus size={15} aria-hidden="true" />
                      Comments
                    </button>
                  ) : null}
                </div>
                <section>
                  <h3>Project</h3>
                  <select
                    className="form-select"
                    aria-label="Project, section, or Inbox"
                    value={
                      detailSectionId === null
                        ? detailProjectId === null
                          ? inboxPlacement
                          : projectPlacement(detailProjectId)
                        : sectionPlacement(detailSectionId)
                    }
                    onChange={async (event) => {
                      const placement = parsePlacement(event.target.value, allSections);
                      setDetailProjectId(placement.projectId);
                      setDetailSectionId(placement.sectionId);
                      setDetailSaveStatus("Saving…");
                      try {
                        await api.moveTask(
                          selectedDetailsTask.id,
                          placement.projectId,
                          placement.sectionId,
                          null,
                          null,
                          null,
                        );
                        await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                        setDetailSaveStatus("Saved");
                      } catch {
                        setDetailProjectId(selectedDetailsTask.projectId);
                        setDetailSectionId(selectedDetailsTask.sectionId);
                        setDetailSaveStatus("Could not save changes");
                      }
                    }}
                  >
                    {createPlacementOptions(
                      activeProjects,
                      allSections.filter(
                        (section) =>
                          section.projectId === null ||
                          activeProjects.some((project) => project.id === section.projectId),
                      ),
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </section>
                <section
                  className={`task-details-optional${!detailDueDate && !showMobileDate ? " task-details-optional-hidden" : ""}`}
                >
                  <div className="task-details-optional-heading">
                    <h3>Date</h3>
                    <button
                      type="button"
                      className="task-details-mobile-collapse"
                      aria-label="Remove date and hide section"
                      onClick={async () => {
                        setDetailDueDate("");
                        setShowMobileDate(false);
                        await saveTaskDetails({ dueDate: null });
                      }}
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                  {detailDueDate ? (
                    <div className="task-detail-meta-value">
                      <button
                        type="button"
                        className={`task-detail-date ${taskDueDateTone(detailDueDate)}`}
                        onClick={() => setDatePickerOpen(true)}
                        title={`Due ${detailDueDate}`}
                      >
                        <CalendarDays size={15} aria-hidden="true" />
                        <span>
                          {isTaskDueToday(detailDueDate)
                            ? "today"
                            : new Date(`${detailDueDate}T00:00:00`).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="task-details-desktop-remove-date"
                        aria-label="Remove date"
                        onClick={async () => {
                          setDetailDueDate("");
                          setShowMobileDate(false);
                          await saveTaskDetails({ dueDate: null });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setShowMobileDate(true);
                        setDatePickerOpen(true);
                      }}
                    >
                      ＋ Add date
                    </button>
                  )}
                </section>
                <section
                  className={`task-details-optional${selectedDetailsTask.labels.length === 0 && !showMobileLabels ? " task-details-optional-hidden" : ""}`}
                >
                  <div className="task-details-optional-heading">
                    <h3>Labels</h3>
                    <button
                      type="button"
                      className="task-details-mobile-collapse"
                      aria-label="Remove all labels and hide section"
                      onClick={() => void closeMobileLabels()}
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <LabelPicker
                    autoFocus={showMobileLabels && selectedDetailsTask.labels.length === 0}
                    selected={selectedDetailsTask.labels}
                    options={availableLabels}
                    inputLabel="Labels"
                    inputValue={detailLabelInput}
                    onInputChange={setDetailLabelInput}
                    onChange={(labels) => saveTaskDetails({ labels })}
                  />
                </section>
                <p className="task-autosave-status" aria-live="polite">
                  {detailSaveStatus}
                </p>
              </aside>
            </div>
            {datePickerOpen ? (
              <div className="task-date-picker-backdrop">
                <section
                  className="task-date-picker"
                  role="dialog"
                  aria-modal="true"
                  aria-label={selectedDetailsTask.dueDate ? "Change date" : "Add date"}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setDetailDueDate(selectedDetailsTask.dueDate ?? "");
                      setDatePickerOpen(false);
                      if (!selectedDetailsTask.dueDate) setShowMobileDate(false);
                    }
                    if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") {
                      event.preventDefault();
                      void saveTaskDetails({ dueDate: detailDueDate || null }).then((saved) => {
                        if (saved) setDatePickerOpen(false);
                      });
                    }
                  }}
                >
                  <h3>{selectedDetailsTask.dueDate ? "Change date" : "Add date"}</h3>
                  <DatePickerPanel
                    autoFocus
                    inputLabel="New date"
                    value={detailDueDate}
                    onChange={setDetailDueDate}
                  />
                  <div className="task-date-picker-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailDueDate(selectedDetailsTask.dueDate ?? "");
                        setDatePickerOpen(false);
                        if (!selectedDetailsTask.dueDate) setShowMobileDate(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={async () => {
                        if (await saveTaskDetails({ dueDate: detailDueDate || null }))
                          setDatePickerOpen(false);
                      }}
                    >
                      Save date
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
};
