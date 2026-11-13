import { ClipboardCopy, Download, Eye } from "lucide-react";

export type ExportKind = "markdown" | "advancedMarkdown" | "json";

type ExportFormatCardProps = Readonly<{
  title: string;
  description: string;
  downloadLabel: string;
  copyLabel: string;
  previewLabel: string;
  onDownload: () => void;
  onCopy: () => void;
  onPreview: () => void;
}>;

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

export type ExportPageProps = Readonly<{
  copyStatus: string;
  onExport: (kind: ExportKind) => void;
  onCopy: (kind: ExportKind) => void;
  onPreview: (kind: ExportKind) => void;
}>;

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
