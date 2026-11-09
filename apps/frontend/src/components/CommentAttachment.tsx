import type { Task } from "@todoist-clone/domain";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const textPreviewExtensions = new Set([
  "md",
  "txt",
  "csv",
  "yaml",
  "yml",
  "json",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "html",
  "py",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "sh",
]);

export const formatAttachmentSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${Number(value.toFixed(1))} ${units[unitIndex]}`;
};

export const renderCommentMarkdown = (body: string) =>
  body.split("\n").map((line, index) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const contentText = heading?.[2] ?? (line.startsWith("- ") ? line.slice(2) : line);
    const parts = contentText
      .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\))/g)
      .filter(Boolean);
    const content = parts.map((part, partIndex) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={partIndex}>{part.slice(1, -1)}</code>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={partIndex}>{part.slice(1, -1)}</em>;
      const link = /^\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)$/.exec(part);
      return link === null ? (
        part
      ) : (
        <a key={partIndex} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    });
    if (heading !== null) return <h4 key={index}>{content}</h4>;
    if (line.startsWith("- "))
      return (
        <div className="comment-markdown-list-item" key={index}>
          • {content}
        </div>
      );
    return <p key={index}>{content}</p>;
  });

export const CommentAttachment = ({
  attachment,
  onRemove,
}: Readonly<{
  attachment: NonNullable<Task["comments"][number]["attachments"]>[number];
  onRemove?: () => void;
}>) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const extension = attachment.name.split(".").at(-1)?.toLowerCase() ?? "";
  const canPreview =
    textPreviewExtensions.has(extension) ||
    attachment.mimeType.startsWith("text/") ||
    attachment.mimeType === "application/json";

  useEffect(() => {
    if (!previewOpen || previewLoaded || previewError.length > 0) return;
    if (attachment.size > 512 * 1024) {
      setPreviewError("Preview is limited to files up to 512 KB.");
      return;
    }
    void fetch(`/attachments/${encodeURIComponent(attachment.id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load preview.");
        return response.text();
      })
      .then((contents) => {
        setPreview(contents);
        setPreviewLoaded(true);
      })
      .catch(() => setPreviewError("Could not load preview."));
  }, [attachment.id, attachment.size, previewError.length, previewLoaded, previewOpen]);

  return (
    <div className="comment-attachment">
      {attachment.mimeType.startsWith("image/") ? (
        <a href={`/attachments/${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer">
          <img
            className="comment-attachment-image"
            src={`/attachments/${encodeURIComponent(attachment.id)}`}
            alt={attachment.name}
          />
        </a>
      ) : null}
      <a href={`/attachments/${encodeURIComponent(attachment.id)}`} download={attachment.name}>
        {attachment.name} ({Math.ceil(attachment.size / 1024)} KB)
      </a>
      {canPreview ? (
        <>
          <button type="button" onClick={() => setPreviewOpen((open) => !open)}>
            {previewOpen ? "Hide preview" : "Preview"}
          </button>
          {previewOpen ? (
            <section className="comment-attachment-preview" aria-label={`Preview ${attachment.name}`}>
              {previewError ? <p role="status">{previewError}</p> : <pre>{preview}</pre>}
            </section>
          ) : null}
        </>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className="danger comment-attachment-remove"
          aria-label={`Remove attachment ${attachment.name}`}
          onClick={onRemove}
        >
          <Trash2 size={14} aria-hidden="true" />
          Remove
        </button>
      ) : null}
    </div>
  );
};
