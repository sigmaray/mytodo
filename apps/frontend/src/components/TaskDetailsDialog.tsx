import type { QueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, Section, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import { Edit3, X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ApplicationApi } from "../api";
import { taskQueryKey } from "../queryKeys";
import { TaskCommentsPanel } from "./TaskCommentsPanel";
import { TaskDetailsSidebar } from "./TaskDetailsSidebar";
import { AutoGrowTextarea, DatePickerPanel } from "./TaskFormFields";

type TaskDetailsPatch = Parameters<ApplicationApi["updateTask"]>[1];

export type TaskDetailsDialogProps = {
  api: ApplicationApi;
  queryClient: QueryClient;
  attachmentsEnabled: boolean;
  selectedDetailsTask: TaskNode | null;
  selectedDetailsProject: Project | null;
  selectedDetailsSection: Section | null;
  selectedDetailsParent: TaskNode | null;
  activeProjects: Array<Project>;
  allSections: Array<Section>;
  availableLabels: Array<string>;
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
  detailCommentFiles: Array<File>;
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
  setDetailCommentFiles: Dispatch<SetStateAction<Array<File>>>;
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
  notifyAttachedFiles: (files: Array<File>) => void;
  pastedFiles: (clipboardData: DataTransfer) => Array<File>;
};

export const TaskDetailsDialog = (props: TaskDetailsDialogProps) => {
  const {
    api,
    queryClient,
    attachmentsEnabled,
    selectedDetailsTask,
    selectedDetailsProject,
    selectedDetailsSection,
    selectedDetailsParent,
    detailTitle,
    detailDescription,
    detailDueDate,
    editingDetailField,
    datePickerOpen,
    showMobileComments,
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
    setEditingDetailField,
    setDatePickerOpen,
    setShowMobileDate,
    setDetailComment,
    setDetailCommentFiles,
    setDetailSubtask,
    setEditingCommentId,
    setEditingCommentBody,
    confirmDeletion,
    saveTaskDetails,
    removeCommentAttachment,
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
                setDetailCommentFiles([...detailCommentFiles, ...acceptedFiles]);
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
              <TaskDetailsSidebar {...props} />
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
