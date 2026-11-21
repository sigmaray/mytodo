import { Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import { formatAttachmentSize } from "../components/CommentAttachment";

/**
 * Attachment entry shown in the shared file library.
 *
 * @typedef {Object} AttachmentLibraryItem
 * @property {string} id - Unique attachment identifier.
 * @property {string} name - Original file name.
 * @property {string} mimeType - File MIME type.
 * @property {number} size - File size in bytes.
 * @property {string} taskId - ID of the task containing the attachment.
 * @property {string} taskTitle - Task title.
 * @property {string} uploadedAt - Time when the file was uploaded.
 */
export type AttachmentLibraryItem = {
  id: string;

  name: string;

  mimeType: string;

  size: number;

  taskId: string;

  taskTitle: string;

  uploadedAt: string;
};

/**
 * Data and handlers for the attachment library page.
 *
 * @typedef {Object} AttachmentsPageProps
 * @property {Array<AttachmentLibraryItem>} attachments - User's attachments.
 * @property {boolean} loading - Whether attachments are loading.
 * @property onTaskOpen - Opens task details.
 */
export type AttachmentsPageProps = {
  attachments: Array<AttachmentLibraryItem>;

  loading: boolean;

  onTaskOpen: (taskId: string) => void;
};

/**
 * Displays the user's files and links to the comments and tasks that use them.
 *
 * @param {AttachmentsPageProps} parameter1
 */
export const AttachmentsPage = ({ attachments, loading, onTaskOpen }: AttachmentsPageProps) => (
  <section className="attachments-page" aria-label="Attachments list">
    {attachments.length > 0 ? (
      attachments.map((attachment) => (
        <article className="attachment-library-item" key={attachment.id}>
          <div className="attachment-library-preview">
            {attachment.mimeType.startsWith("image/") ? (
              <a href={`/attachments/${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer">
                <img src={`/attachments/${encodeURIComponent(attachment.id)}`} alt={attachment.name} />
              </a>
            ) : (
              <Paperclip size={28} aria-hidden="true" />
            )}
          </div>
          <div className="attachment-library-details">
            <a
              className="attachment-library-file-link"
              href={`/attachments/${encodeURIComponent(attachment.id)}`}
              download={attachment.name}
            >
              {attachment.name}
            </a>
            <Link
              className="attachment-library-task-link"
              to="/attachments"
              onClick={() => onTaskOpen(attachment.taskId)}
            >
              {attachment.taskTitle}
            </Link>
            <dl>
              <div>
                <dt>Size</dt>
                <dd>{formatAttachmentSize(attachment.size)}</dd>
              </div>
              <div>
                <dt>Uploaded</dt>
                <dd>
                  <time dateTime={attachment.uploadedAt}>
                    {new Date(attachment.uploadedAt).toLocaleString()}
                  </time>
                </dd>
              </div>
            </dl>
          </div>
        </article>
      ))
    ) : loading ? (
      <p className="muted">Loading attachments...</p>
    ) : (
      <p className="empty">No attachments yet.</p>
    )}
  </section>
);
