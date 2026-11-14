import { useQueryClient } from "@tanstack/react-query";
import type { TaskNode } from "@todoist-clone/domain";
import { X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ApplicationApi } from "../api";
import { taskQueryKey } from "../queryKeys";
import { CommentAttachment, renderCommentMarkdown } from "./CommentAttachment";
import { AutoGrowTextarea } from "./TaskFormFields";

/**
 * @callback TaskCommentsPanelPropsOnHide
 * @returns {void | Promise<void>}
 */

/**
 * @callback TaskCommentsPanelPropsRemoveCommentAttachment
 * @param {string} commentId
 * @param {string} attachmentId
 * @returns {Promise<void>}
 */

/**
 * @callback TaskCommentsPanelPropsConfirmDeletion
 * @param {string} message
 * @returns {boolean}
 */

/**
 * @callback TaskCommentsPanelPropsNotifyAttachedFiles
 * @param {Array<File>} files
 * @returns {void}
 */
/**
 * Данные задачи, состояние редактора комментариев и операции над вложениями.
 *
 * @typedef {Object} TaskCommentsPanelProps
 * @property {TaskNode} task - Данные «задача», используемые типом «TaskCommentsPanelProps».
 * @property {ApplicationApi} api - Набор API-операций для серверных данных.
 * @property {boolean} attachmentsEnabled - Разрешено ли приложению загружать и выдавать вложения.
 * @property {boolean} showMobileComments - Признак, что мобильный блок комментариев открыт.
 * @property {TaskCommentsPanelPropsOnHide} onHide - Закрывает мобильную панель.
 * @property {string | null} editingCommentId - Данные «редактируемое комментарий id», используемые типом «TaskCommentsPanelProps».
 * @property {Dispatch<SetStateAction<string | null>>} setEditingCommentId - Обновляет значение соответствующего состояния.
 * @property {string} editingCommentBody - Черновик текста редактируемого комментария.
 * @property {Dispatch<SetStateAction<string>>} setEditingCommentBody - Обновляет значение соответствующего состояния.
 * @property {string} detailComment - Черновик текста нового комментария.
 * @property {Dispatch<SetStateAction<string>>} setDetailComment - Обновляет значение соответствующего состояния.
 * @property {Array<File>} detailCommentFiles - Файлы для нового комментария.
 * @property {Dispatch<SetStateAction<Array<File>>>} setDetailCommentFiles - Обновляет значение соответствующего состояния.
 * @property {TaskCommentsPanelPropsRemoveCommentAttachment} removeCommentAttachment - Удаляет файл, прикреплённый к комментарию.
 * @property {TaskCommentsPanelPropsConfirmDeletion} confirmDeletion - Запрашивает подтверждение перед удалением.
 * @property {TaskCommentsPanelPropsNotifyAttachedFiles} notifyAttachedFiles - Сообщает о выбранных файлах.
 */
type TaskCommentsPanelProps = {
  task: TaskNode;

  api: ApplicationApi;

  attachmentsEnabled: boolean;

  showMobileComments: boolean;

  onHide: () => void | Promise<void>;

  editingCommentId: string | null;

  setEditingCommentId: Dispatch<SetStateAction<string | null>>;

  editingCommentBody: string;

  setEditingCommentBody: Dispatch<SetStateAction<string>>;

  detailComment: string;

  setDetailComment: Dispatch<SetStateAction<string>>;

  detailCommentFiles: Array<File>;

  setDetailCommentFiles: Dispatch<SetStateAction<Array<File>>>;

  removeCommentAttachment: (commentId: string, attachmentId: string) => Promise<void>;

  confirmDeletion: (message: string) => boolean;

  notifyAttachedFiles: (files: Array<File>) => void;
};

/**
 * Отображает обсуждение задачи, формы комментариев и действия с вложениями.
 *
 * @param {TaskCommentsPanelProps} parameter1
 * @returns Результат выполнения функции.
 */
export const TaskCommentsPanel = ({ task, ...props }: TaskCommentsPanelProps) => {
  const {
    api,
    attachmentsEnabled,
    showMobileComments,
    onHide,
    editingCommentId,
    setEditingCommentId,
    editingCommentBody,
    setEditingCommentBody,
    detailComment,
    setDetailComment,
    detailCommentFiles,
    setDetailCommentFiles,
    removeCommentAttachment,
    confirmDeletion,
    notifyAttachedFiles,
  } = props;
  const _selectedDetailsTask = task;
  const queryClient = useQueryClient();
  return (
    <section
      className={`task-comments task-details-optional${task.comments.length === 0 && !showMobileComments ? " task-details-optional-hidden" : ""}`}
    >
      <div className="task-details-optional-heading">
        <h3>Comments</h3>
        <button
          type="button"
          className="task-details-mobile-collapse"
          aria-label="Remove all comments and hide section"
          onClick={() => void onHide()}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      {task.comments.map((comment) => (
        <article className="task-comment" key={comment.id}>
          {editingCommentId === comment.id ? (
            <>
              <AutoGrowTextarea
                autoFocus
                ariaLabel={`Edit comment ${comment.id}`}
                value={editingCommentBody}
                onChange={setEditingCommentBody}
              />
              {attachmentsEnabled
                ? comment.attachments?.map((attachment) => (
                    <CommentAttachment
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => void removeCommentAttachment(comment.id, attachment.id)}
                    />
                  ))
                : null}
              <div className="task-comment-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    /** Сохраняем полный список комментариев, меняя текст только выбранного сообщения. */
                    const comments = task.comments.map((item) =>
                      item.id === comment.id ? { ...item, body: editingCommentBody.trim() } : item,
                    );
                    await api.updateTask(task.id, { comments });
                    setEditingCommentId(null);
                    await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                  }}
                >
                  Save comment
                </button>
                <button type="button" onClick={() => setEditingCommentId(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {comment.body.trim() ? (
                <div className="comment-markdown">{renderCommentMarkdown(comment.body)}</div>
              ) : null}
              {attachmentsEnabled
                ? comment.attachments?.map((attachment) => (
                    <CommentAttachment
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => void removeCommentAttachment(comment.id, attachment.id)}
                    />
                  ))
                : null}
              <small>{new Date(comment.createdAt).toLocaleString()}</small>
              <div className="task-comment-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditingCommentBody(comment.body);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={async () => {
                    /** Удаление требует подтверждения согласно пользовательской настройке. */
                    if (!confirmDeletion("Delete this comment?")) return;
                    await api.updateTask(task.id, {
                      comments: task.comments.filter((item) => item.id !== comment.id),
                    });
                    await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </article>
      ))}
      <div className="card border rounded p-3 mt-3">
        <label>
          Add comment
          <AutoGrowTextarea
            autoFocus={showMobileComments && task.comments.length === 0}
            ariaLabel="Add comment"
            value={detailComment}
            onChange={setDetailComment}
            onKeyDown={async (event) => {
              if (event.key === "Enter" && event.ctrlKey) {
                event.preventDefault();
                /** Пустая отправка игнорируется, если пользователь не выбрал файл. */
                if (!detailComment.trim() && detailCommentFiles.length === 0) return;
                if (detailCommentFiles.length) {
                  /** Маршрут загрузки отдельно сохраняет файлы и текст комментария. */
                  await api.createComment(task.id, detailComment.trim(), detailCommentFiles);
                } else {
                  /** Комментарий без файлов отправляется как обновление списка комментариев задачи. */
                  const comments = [
                    ...task.comments,
                    {
                      body: detailComment.trim(),
                    },
                  ];
                  await api.updateTask(task.id, { comments });
                }
                setDetailComment("");
                setDetailCommentFiles([]);
                await queryClient.invalidateQueries({ queryKey: taskQueryKey });
              }
            }}
          />
          <small className="editor-hint">Press Ctrl+Enter to save.</small>
        </label>
        {attachmentsEnabled ? (
          <>
            <label className="attachment-picker">
              Attach files
              <input
                aria-label="Attach files to comment"
                type="file"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  /** Ограничиваем добавление числом файлов, которое ещё помещается в лимит. */
                  const acceptedFiles = files.slice(0, Math.max(0, 10 - detailCommentFiles.length));
                  setDetailCommentFiles([...detailCommentFiles, ...acceptedFiles]);
                  notifyAttachedFiles(acceptedFiles);
                  /** Сбрасываем input, чтобы можно было повторно выбрать тот же файл. */
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {detailCommentFiles.map((file, index) => (
              <span className="attachment-draft" key={`${file.name}-${file.lastModified}-${index}`}>
                {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setDetailCommentFiles(detailCommentFiles.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          disabled={!detailComment.trim() && detailCommentFiles.length === 0}
          onClick={async () => {
            /** Файлы отправляются через endpoint загрузки, обычный текст — через PATCH задачи. */
            if (detailCommentFiles.length) {
              await api.createComment(task.id, detailComment.trim(), detailCommentFiles);
            } else {
              const comments = [
                ...task.comments,
                {
                  body: detailComment.trim(),
                },
              ];
              await api.updateTask(task.id, { comments });
            }
            setDetailComment("");
            setDetailCommentFiles([]);
            await queryClient.invalidateQueries({ queryKey: taskQueryKey });
          }}
        >
          Add comment
        </button>
      </div>
    </section>
  );
};
