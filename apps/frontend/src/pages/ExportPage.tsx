import { ClipboardCopy, Download, Eye } from "lucide-react";

/** Форматы, которые интерфейс предлагает для экспорта и предпросмотра данных. */
export type ExportKind = "markdown" | "advancedMarkdown" | "json";

/** Подписи и обработчики одной карточки формата экспорта. */
type ExportFormatCardProps = {
  /** Название формата. */
  title: string;
  /** Краткое описание содержимого файла. */
  description: string;
  /** Подпись кнопки скачивания. */
  downloadLabel: string;
  /** Подпись кнопки копирования. */
  copyLabel: string;
  /** Подпись кнопки предпросмотра. */
  previewLabel: string;
  /** Запускает сохранение файла. */
  onDownload: () => void;
  /** Копирует данные в буфер обмена. */
  onCopy: () => void;
  /** Открывает предпросмотр данных. */
  onPreview: () => void;
};

/** Отображает набор действий для одного формата экспорта. */
const ExportFormatCard = ({
  title,
  description,
  downloadLabel,
  copyLabel,
  previewLabel,
  onDownload,
  onCopy,
  onPreview,
}: ExportFormatCardProps) => (
  <section className="card export-format-card" aria-label={`${title} export`}>
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
    <div className="export-format-actions">
      <button type="button" className="btn-primary" onClick={onDownload}>
        <Download size={16} aria-hidden="true" />
        {downloadLabel}
      </button>
      <button type="button" onClick={onCopy}>
        <ClipboardCopy size={16} aria-hidden="true" />
        {copyLabel}
      </button>
      <button type="button" onClick={onPreview}>
        <Eye size={16} aria-hidden="true" />
        {previewLabel}
      </button>
    </div>
  </section>
);

/** Статус копирования и действия для экспорта всех данных. */
export type ExportPageProps = {
  /** Сообщение об успешном копировании или пустая строка. */
  copyStatus: string;
  /** Скачивает данные в указанном формате. */
  onExport: (kind: ExportKind) => void;
  /** Копирует данные указанного формата. */
  onCopy: (kind: ExportKind) => void;
  /** Показывает предпросмотр выбранного формата. */
  onPreview: (kind: ExportKind) => void;
};

/** Показывает доступные форматы полного экспорта и их действия. */
export const ExportPage = ({ copyStatus, onExport, onCopy, onPreview }: ExportPageProps) => (
  <section className="export-page" aria-label="Export data">
    <ExportFormatCard
      title="Markdown"
      description="Human-readable task lists organized by Inbox, projects, and sections."
      downloadLabel="Export all markdown"
      copyLabel="Copy all markdown"
      previewLabel="Preview all markdown"
      onDownload={() => onExport("markdown")}
      onCopy={() => onCopy("markdown")}
      onPreview={() => onPreview("markdown")}
    />
    <ExportFormatCard
      title="Advanced markdown"
      description="Includes task descriptions, due dates, labels, comments, and Inbox and project descriptions."
      downloadLabel="Export all advanced markdown"
      copyLabel="Copy all advanced markdown"
      previewLabel="Preview all advanced markdown"
      onDownload={() => onExport("advancedMarkdown")}
      onCopy={() => onCopy("advancedMarkdown")}
      onPreview={() => onPreview("advancedMarkdown")}
    />
    <ExportFormatCard
      title="JSON"
      description="Complete structured data, including descriptions, dates, sections, task hierarchy, labels, comments, and archived projects."
      downloadLabel="Export all JSON"
      copyLabel="Copy all JSON"
      previewLabel="Preview all JSON"
      onDownload={() => onExport("json")}
      onCopy={() => onCopy("json")}
      onPreview={() => onPreview("json")}
    />
    {copyStatus.length > 0 ? (
      <p className="muted" role="status">
        {copyStatus}
      </p>
    ) : null}
  </section>
);
