import { Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import { formatAttachmentSize } from "../components/CommentAttachment";

/** Представление вложения в общей библиотеке файлов. */
export type AttachmentLibraryItem = {
  /** UUID файла для URL просмотра и скачивания. */
  id: string;
  /** Имя файла, выбранное при загрузке. */
  name: string;
  /** MIME-тип файла для выбора способа предварительного просмотра. */
  mimeType: string;
  /** Размер файла в байтах. */
  size: number;
  /** Задача, к комментарию которой приложен файл. */
  taskId: string;
  /** Название связанной задачи. */
  taskTitle: string;
  /** Время загрузки, показываемое в карточке файла. */
  uploadedAt: string;
};

/** Данные и обработчики страницы библиотеки вложений. */
export type AttachmentsPageProps = {
  /** Файлы, извлечённые из комментариев текущего пользователя. */
  attachments: Array<AttachmentLibraryItem>;
  /** Показывает состояние ожидания данных. */
  loading: boolean;
  /** Открывает подробности задачи, связанной с файлом. */
  onTaskOpen: (taskId: string) => void;
};

/** Отображает файлы пользователя и ссылки на комментарии/задачи, где они используются. */
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
