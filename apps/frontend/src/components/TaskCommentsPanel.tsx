import { useQueryClient } from "@tanstack/react-query";
import type { TaskNode } from "@todoist-clone/domain";
import { X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ApplicationApi } from "../api";
import { taskQueryKey } from "../queryKeys";
import { CommentAttachment, renderCommentMarkdown } from "./CommentAttachment";
import { AutoGrowTextarea } from "./TaskFormFields";

/**
 * Task data, comment editor state, and attachment operations.
 *
 * @typedef {Object} TaskCommentsPanelProps
 * @property {TaskNode} task - Task whose comments are displayed.
 * @property {ApplicationApi} api - API operations for server data.
 * @property {boolean} attachmentsEnabled - Whether the application can upload and serve attachments.
 * @property {boolean} showMobileComments - Whether the mobile comments panel is open.
 * @property onHide - Closes the mobile panel.
 * @property {string | null} editingCommentId - ID of the comment currently being edited.
 * @property {Dispatch<SetStateAction<string | null>>} setEditingCommentId - Updates the edited comment ID.
 * @property {string} editingCommentBody - Draft text for the comment being edited.
 * @property {Dispatch<SetStateAction<string>>} setEditingCommentBody - Updates the edited comment draft.
 * @property {string} detailComment - Draft text for a new comment.
 * @property {Dispatch<SetStateAction<string>>} setDetailComment - Updates the new comment draft.
 * @property {Array<File>} detailCommentFiles - Files attached to the new comment.
 * @property {Dispatch<SetStateAction<Array<File>>>} setDetailCommentFiles - Updates files for the new comment.
 * @property removeCommentAttachment - Removes a file attached to a comment.
 * @property confirmDeletion - Requests confirmation before deletion.
 * @property notifyAttachedFiles - Reports the selected files.
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
 * Displays the task discussion, comment forms, and attachment actions.
 *
 * @param {TaskCommentsPanelProps} parameter1
 * @returns The task comments panel.
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
                    /** Save the full comment list while changing only the selected comment text. */
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
                    /** Require confirmation according to the user's settings before deleting. */
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
                /** Ignore an empty submission when no file has been selected. */
                if (!detailComment.trim() && detailCommentFiles.length === 0) return;
                if (detailCommentFiles.length) {
                  /** The upload route saves the files and comment text together. */
                  await api.createComment(task.id, detailComment.trim(), detailCommentFiles);
                } else {
                  /** Send a comment without files as an update to the task's comment list. */
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
                  /** Limit added files to the remaining available file count. */
                  const acceptedFiles = files.slice(0, Math.max(0, 10 - detailCommentFiles.length));
                  setDetailCommentFiles([...detailCommentFiles, ...acceptedFiles]);
                  notifyAttachedFiles(acceptedFiles);
                  /** Reset the input so the same file can be selected again. */
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
            /** Upload files through the upload endpoint and send text through the task PATCH route. */
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
