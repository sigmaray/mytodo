import type { QueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, Section, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import { Edit3, X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ApplicationApi } from "../api";
import { taskQueryKey } from "../queryKeys";
import { TaskCommentsPanel } from "./TaskCommentsPanel";
import { TaskDetailsSidebar } from "./TaskDetailsSidebar";
import { AutoGrowTextarea, DatePickerPanel } from "./TaskFormFields";

/** Изменяемые поля задачи, совпадающие с контрактом API обновления. */
type TaskDetailsPatch = Parameters<ApplicationApi["updateTask"]>[1];

/** Данные, состояние и действия модального окна подробностей задачи. */
export type TaskDetailsDialogProps = {
  /** Клиент API задач и комментариев. */
  api: ApplicationApi;
  /** Кэш запросов для обновления подробностей после сохранения. */
  queryClient: QueryClient;
  /** Разрешены ли вложения в комментариях. */
  attachmentsEnabled: boolean;
  /** Текущая задача или `null`, если диалог закрыт. */
  selectedDetailsTask: TaskNode | null;
  /** Проект текущей задачи, если она находится в проекте. */
  selectedDetailsProject: Project | null;
  /** Секция текущей задачи, если она назначена в секцию. */
  selectedDetailsSection: Section | null;
  /** Родитель текущей задачи в дереве. */
  selectedDetailsParent: TaskNode | null;
  /** Проекты, доступные для выбора места задачи. */
  activeProjects: Array<Project>;
  /** Секции для выбора и показа связанного контекста. */
  allSections: Array<Section>;
  /** Метки, доступные в поле выбора. */
  availableLabels: Array<string>;
  /** Черновик названия задачи. */
  detailTitle: string;
  /** Черновик описания задачи. */
  detailDescription: string;
  /** Черновик срока задачи в ISO-формате или пустая строка. */
  detailDueDate: string;
  /** Вводимое значение для добавления метки. */
  detailLabelInput: string;
  /** Текст результата сохранения подробностей. */
  detailSaveStatus: string;
  /** Выбранный проект или `null` для Входящих. */
  detailProjectId: ProjectId | null;
  /** Выбранная секция или `null` для корневого списка. */
  detailSectionId: SectionId | null;
  /** Поле, которое сейчас редактируется inline. */
  editingDetailField: "title" | "description" | null;
  /** Открыт ли выбор срока. */
  datePickerOpen: boolean;
  /** Нужно ли показывать мобильный блок меток. */
  showMobileLabels: boolean;
  /** Нужно ли показывать мобильный блок комментариев. */
  showMobileComments: boolean;
  /** Нужно ли показывать мобильный блок срока. */
  showMobileDate: boolean;
  /** Нужно ли показывать мобильный блок подзадач. */
  showMobileSubtasks: boolean;
  /** Черновик нового комментария. */
  detailComment: string;
  /** Файлы, выбранные для нового комментария. */
  detailCommentFiles: Array<File>;
  /** Черновик названия новой подзадачи. */
  detailSubtask: string;
  /** ID комментария, который сейчас редактируется. */
  editingCommentId: string | null;
  /** Черновик текста редактируемого комментария. */
  editingCommentBody: string;
  /** Ref секции подзадач для прокрутки к ней при открытии. */
  subtasksSectionRef: RefObject<HTMLElement | null>;
  /** Закрывает окно подробностей и сбрасывает выбранную задачу. */
  setDetailsTaskId: Dispatch<SetStateAction<TaskId | null>>;
  /** Обновляет черновик названия задачи. */
  setDetailTitle: Dispatch<SetStateAction<string>>;
  /** Обновляет черновик описания задачи. */
  setDetailDescription: Dispatch<SetStateAction<string>>;
  /** Обновляет черновик срока. */
  setDetailDueDate: Dispatch<SetStateAction<string>>;
  /** Обновляет ввод метки. */
  setDetailLabelInput: Dispatch<SetStateAction<string>>;
  /** Обновляет статус сохранения. */
  setDetailSaveStatus: Dispatch<SetStateAction<string>>;
  /** Меняет проект назначения. */
  setDetailProjectId: Dispatch<SetStateAction<ProjectId | null>>;
  /** Меняет секцию назначения. */
  setDetailSectionId: Dispatch<SetStateAction<SectionId | null>>;
  /** Выбирает или закрывает inline-редактирование поля. */
  setEditingDetailField: Dispatch<SetStateAction<"title" | "description" | null>>;
  /** Управляет открытием календаря срока. */
  setDatePickerOpen: Dispatch<SetStateAction<boolean>>;
  /** Управляет видимостью мобильного блока меток. */
  setShowMobileLabels: Dispatch<SetStateAction<boolean>>;
  /** Управляет видимостью мобильного блока комментариев. */
  setShowMobileComments: Dispatch<SetStateAction<boolean>>;
  /** Управляет видимостью мобильного блока срока. */
  setShowMobileDate: Dispatch<SetStateAction<boolean>>;
  /** Управляет видимостью мобильного блока подзадач. */
  setShowMobileSubtasks: Dispatch<SetStateAction<boolean>>;
  /** Обновляет текст нового комментария. */
  setDetailComment: Dispatch<SetStateAction<string>>;
  /** Обновляет файлы нового комментария. */
  setDetailCommentFiles: Dispatch<SetStateAction<Array<File>>>;
  /** Обновляет текст новой подзадачи. */
  setDetailSubtask: Dispatch<SetStateAction<string>>;
  /** Выбирает комментарий для редактирования. */
  setEditingCommentId: Dispatch<SetStateAction<string | null>>;
  /** Обновляет черновик комментария. */
  setEditingCommentBody: Dispatch<SetStateAction<string>>;
  /** Спрашивает подтверждение перед удалением согласно настройкам. */
  confirmDeletion: (message: string) => boolean;
  /** Сохраняет изменённые поля задачи и возвращает результат операции. */
  saveTaskDetails: (patch: TaskDetailsPatch) => Promise<boolean>;
  /** Удаляет файл, связанный с комментарием. */
  removeCommentAttachment: (commentId: string, attachmentId: string) => Promise<void>;
  /** Сохраняет мобильные метки перед сворачиванием панели. */
  closeMobileLabels: () => Promise<void>;
  /** Закрывает мобильную панель комментариев. */
  closeMobileComments: () => Promise<void>;
  /** Закрывает мобильную панель подзадач. */
  closeMobileSubtasks: () => Promise<void>;
  /** Открывает подробности указанной задачи. */
  openDetails: (task: TaskNode) => void;
  /** Уведомляет о выбранных вложениях. */
  notifyAttachedFiles: (files: Array<File>) => void;
  /** Извлекает файлы из события вставки. */
  pastedFiles: (clipboardData: DataTransfer) => Array<File>;
};

/** Показывает подробности задачи и управляет её текстом, сроком и обсуждением. */
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
            // Закрываем окно только при нажатии на свободную область вокруг карточки.
            if (event.target === event.currentTarget) setDetailsTaskId(null);
          }}
        >
          <section
            className="task-details-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Task details: ${selectedDetailsTask.title}`}
            onPasteCapture={(event) => {
              // Вложения из буфера включаются только в режиме поддержки файлов.
              if (!attachmentsEnabled) return;
              const files = pastedFiles(event.clipboardData);
              if (files.length > 0) {
                event.preventDefault();
                // Применяем тот же лимит, что и при выборе файлов через input.
                const acceptedFiles = files.slice(0, Math.max(0, 10 - detailCommentFiles.length));
                setDetailCommentFiles([...detailCommentFiles, ...acceptedFiles]);
                notifyAttachedFiles(acceptedFiles);
              }
            }}
            onKeyDown={(event) => {
              // Escape не закрывает окно, пока пользователь редактирует поле или выбирает дату.
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
                            // Закрываем редактор только после успешного сохранения непустого заголовка.
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
                            // Кнопка Save использует ту же проверку, что и клавиша Enter.
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
                            // Ctrl+Enter сохраняет многострочное описание, обычный Enter создаёт строку.
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
                            // Ошибка сохранения оставляет редактор открытым для повторной попытки.
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
                            // Подтверждение защищает подзадачу и её потомков от случайного удаления.
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
                            // Пустое название не создаёт подзадачу.
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
                          // Кнопка добавления повторяет клавиатурный путь создания подзадачи.
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
                      // Отмена восстанавливает срок с сохранённой задачи и закрывает вложенный диалог.
                      event.preventDefault();
                      event.stopPropagation();
                      setDetailDueDate(selectedDetailsTask.dueDate ?? "");
                      setDatePickerOpen(false);
                      if (!selectedDetailsTask.dueDate) setShowMobileDate(false);
                    }
                    if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") {
                      event.preventDefault();
                      // Enter в поле даты сохраняет значение, но на кнопке оставляет штатное действие.
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
