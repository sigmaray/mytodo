import { ClipboardCopy, Download, Eye } from "lucide-react";

/**
 * Formats offered by the interface for exporting and previewing data.
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
 * Labels and handlers for one export format card.
 *
 * @typedef {Object} ExportFormatCardProps
 * @property {string} title - Card title.
 * @property {string} description - Format description.
 * @property {string} downloadLabel - Label for the download button.
 * @property {string} copyLabel - Label for the copy button.
 * @property {string} previewLabel - Label for the preview button.
 * @property {ExportFormatCardPropsOnDownload} onDownload - Downloads data in the selected format.
 * @property {ExportFormatCardPropsOnCopy} onCopy - Copies data to the clipboard.
 * @property {ExportFormatCardPropsOnPreview} onPreview - Opens a data preview.
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
 * Renders the available actions for one export format.
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
 * Copy status and actions for exporting all data.
 *
 * @typedef {Object} ExportPageProps
 * @property {string} copyStatus - Result of the most recent copy operation.
 * @property {ExportPagePropsOnExport} onExport - Starts the data export.
 * @property {ExportPagePropsOnCopy} onCopy - Copies the export to the clipboard.
 * @property {ExportPagePropsOnPreview} onPreview - Shows an export preview.
 */
export type ExportPageProps = {
  copyStatus: string;

  onExport: (kind: ExportKind) => void;

  onCopy: (kind: ExportKind) => void;

  onPreview: (kind: ExportKind) => void;
};

/**
 * Shows available full export formats and their actions.
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
