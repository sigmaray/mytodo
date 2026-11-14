import { ClipboardCopy, Download, Eye } from "lucide-react";

/**
 * Форматы, которые интерфейс предлагает для экспорта и предпросмотра данных.
 *
 * @typedef {"markdown" | "advancedMarkdown" | "json"} ExportKind
 */
export type ExportKind = "markdown" | "advancedMarkdown" | "json";

/**
 * @callback ExportFormatCardPropsOnDownload
 * @returns {void}
 */

/**
 * @callback ExportFormatCardPropsOnCopy
 * @returns {void}
 */

/**
 * @callback ExportFormatCardPropsOnPreview
 * @returns {void}
 */
/**
 * Подписи и обработчики одной карточки формата экспорта.
 *
 * @typedef {Object} ExportFormatCardProps
 * @property {string} title - Данные «заголовок», используемые типом «ExportFormatCardProps».
 * @property {string} description - Данные «описание», используемые типом «ExportFormatCardProps».
 * @property {string} downloadLabel - Подпись кнопки скачивания.
 * @property {string} copyLabel - Подпись кнопки копирования.
 * @property {string} previewLabel - Подпись кнопки предпросмотра.
 * @property {ExportFormatCardPropsOnDownload} onDownload - Скачивает данные в выбранном формате.
 * @property {ExportFormatCardPropsOnCopy} onCopy - Копирует данные в буфер обмена.
 * @property {ExportFormatCardPropsOnPreview} onPreview - Открывает предпросмотр данных.
 */
type ExportFormatCardProps = {
  title: string;

  description: string;

  downloadLabel: string;

  copyLabel: string;

  previewLabel: string;

  onDownload: () => void;

  onCopy: () => void;

  onPreview: () => void;
};

/**
 * Отображает набор действий для одного формата экспорта.
 *
 * @param {ExportFormatCardProps} parameter1
 */
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

/**
 * @callback ExportPagePropsOnExport
 * @param {ExportKind} kind
 * @returns {void}
 */

/**
 * @callback ExportPagePropsOnCopy
 * @param {ExportKind} kind
 * @returns {void}
 */

/**
 * @callback ExportPagePropsOnPreview
 * @param {ExportKind} kind
 * @returns {void}
 */
/**
 * Статус копирования и действия для экспорта всех данных.
 *
 * @typedef {Object} ExportPageProps
 * @property {string} copyStatus - Результат последней операции копирования.
 * @property {ExportPagePropsOnExport} onExport - Запускает экспорт данных.
 * @property {ExportPagePropsOnCopy} onCopy - Копирует экспорт в буфер обмена.
 * @property {ExportPagePropsOnPreview} onPreview - Показывает предпросмотр экспорта.
 */
export type ExportPageProps = {
  copyStatus: string;

  onExport: (kind: ExportKind) => void;

  onCopy: (kind: ExportKind) => void;

  onPreview: (kind: ExportKind) => void;
};

/**
 * Показывает доступные форматы полного экспорта и их действия.
 *
 * @param {ExportPageProps} parameter1
 */
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
