import type { useFloating } from "@floating-ui/react";
import { FloatingFocusManager, FloatingOverlay } from "@floating-ui/react";
import type { Project, ProjectId, Section, TaskNode } from "@todoist-clone/domain";
import clsx from "clsx";
import { ClipboardCopy, Eye, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { copyText, createPlacementOptions } from "../taskAppUtils";

/** Данные открытого предпросмотра Markdown или JSON. */
export type TaskAppMarkdownModal = {
  /** Заголовок окна предпросмотра. */
  title: string;
  /** Текст документа для отображения внутри окна. */
  markdown: string;
  /** Тип содержимого, определяющий подпись формата. */
  format?: "markdown" | "advanced-markdown" | "json";
};

/** Состояние и действия модальных окон массового перемещения и экспорта. */
type TaskAppOverlaysProps = {
  /** Открыт ли диалог перемещения выбранных задач. */
  selectedMoveOpen: boolean;
  /** Закрывает или открывает диалог массового перемещения. */
  setSelectedMoveOpen: (open: boolean) => void;
  /** Корневые задачи, выбранные для перемещения. */
  selectedRootTasks: Array<TaskNode>;
  /** Текущий выбор целевого проекта или секции. */
  selectedMovePlacement: string;
  /** Меняет целевое место перемещения. */
  setSelectedMovePlacement: (placement: string) => void;
  /** Проекты, доступные для выбора назначения. */
  activeProjects: Array<Project>;
  /** Секции, доступные для выбора назначения. */
  allSections: Array<Section>;
  /** Выполняется ли запрос перемещения. */
  selectedMovePending: boolean;
  /** Подтверждает и выполняет перемещение выбранных задач. */
  moveSelectedTasks: () => void;
  /** Данные открытого предпросмотра или `null`, если окно закрыто. */
  markdownModal: TaskAppMarkdownModal | null;
  /** Управляет открытием и содержимым предпросмотра. */
  setMarkdownModal: Dispatch<SetStateAction<TaskAppMarkdownModal | null>>;
  /** Позиционирование и поведение фокуса плавающего окна. */
  markdownFloating: ReturnType<typeof useFloating>;
  /** Открыты ли варианты scoped-экспорта текущей области. */
  scopeExportOpen: boolean;
  /** Закрывает или открывает варианты scoped-экспорта. */
  setScopeExportOpen: (open: boolean) => void;
  /** ID текущего проекта либо `null` для Входящих. */
  targetProjectId: ProjectId | null;
  /** Данные проекта для отображения названия и описания. */
  scopeProject: Project | null;
  /** Заголовок текущей области задач. */
  taskTargetLabel: string;
  /** Простой Markdown текущей области. */
  markdown: string;
  /** Расширенный Markdown текущей области. */
  advancedMarkdown: string;
  /** JSON текущей области. */
  scopeJson: string;
  /** Текст статуса последнего копирования. */
  copyStatus: string;
  /** Устанавливает текст статуса копирования. */
  setCopyStatus: (status: string) => void;
};

/** Отображает модальные окна экспорта и массового перемещения задач. */
export const TaskAppOverlays = ({
  selectedMoveOpen,
  setSelectedMoveOpen,
  selectedRootTasks,
  selectedMovePlacement,
  setSelectedMovePlacement,
  activeProjects,
  allSections,
  selectedMovePending,
  moveSelectedTasks,
  markdownModal,
  setMarkdownModal,
  markdownFloating,
  scopeExportOpen,
  setScopeExportOpen,
  targetProjectId,
  scopeProject,
  taskTargetLabel,
  markdown,
  advancedMarkdown,
  scopeJson,
  copyStatus,
  setCopyStatus,
}: TaskAppOverlaysProps) => (
  <>
    {selectedMoveOpen ? (
      <div
        className="selection-move-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          // Клик по фону отменяет массовое перемещение, клик внутри формы — нет.
          if (event.target === event.currentTarget) setSelectedMoveOpen(false);
        }}
      >
        <section
          className="selection-move-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Move selected tasks"
          onKeyDown={(event) => {
            // Escape закрывает диалог массового перемещения.
            if (event.key === "Escape") setSelectedMoveOpen(false);
          }}
        >
          <h2>
            Move {selectedRootTasks.length} selected {selectedRootTasks.length === 1 ? "task" : "tasks"}
          </h2>
          <label htmlFor="selected-task-placement">Project, section, or Inbox</label>
          <select
            id="selected-task-placement"
            aria-label="Move selected tasks to"
            value={selectedMovePlacement}
            onChange={(event) => setSelectedMovePlacement(event.target.value)}
          >
            {createPlacementOptions(
              activeProjects,
              allSections.filter(
                (section) =>
                  section.projectId === null ||
                  activeProjects.some((project) => project.id === section.projectId),
              ),
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div>
            <button type="button" onClick={() => setSelectedMoveOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={selectedMovePending}
              onClick={moveSelectedTasks}
            >
              Move selected tasks
            </button>
          </div>
        </section>
      </div>
    ) : null}
    {markdownModal !== null ? (
      <FloatingOverlay
        className={clsx("markdown-modal-backdrop", scopeExportOpen && "scope-preview-backdrop")}
        lockScroll
      >
        <FloatingFocusManager context={markdownFloating.context}>
          <section
            ref={markdownFloating.refs.setFloating}
            className="markdown-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              markdownModal.format === "json"
                ? "JSON preview"
                : markdownModal.format === "advanced-markdown"
                  ? "Advanced markdown preview"
                  : "Markdown preview"
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                // Закрытие предпросмотра освобождает focus manager от текущего диалога.
                setMarkdownModal(null);
              }
            }}
          >
            <header className="markdown-modal-header">
              <h2>
                {markdownModal.title}{" "}
                {markdownModal.format === "advanced-markdown"
                  ? "advanced markdown"
                  : (markdownModal.format ?? "markdown")}
              </h2>
              <button type="button" onClick={() => setMarkdownModal(null)}>
                <X size={16} aria-hidden="true" />
                Close
              </button>
            </header>
            <pre>{markdownModal.markdown}</pre>
          </section>
        </FloatingFocusManager>
      </FloatingOverlay>
    ) : null}
    {scopeExportOpen ? (
      <div
        className="export-options-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          // Закрываем настройки экспорта только по клику на затемнённый фон.
          if (event.target === event.currentTarget) setScopeExportOpen(false);
        }}
      >
        <section
          className="export-options-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Export options"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Escape закрывает список вариантов, не меняя открытое окно предпросмотра.
              event.preventDefault();
              setScopeExportOpen(false);
            }
          }}
        >
          <header>
            <div>
              <p className="eyebrow">Export</p>
              <h2>{targetProjectId === null ? "Inbox" : (scopeProject?.title ?? taskTargetLabel)}</h2>
            </div>
            <button type="button" aria-label="Close export options" onClick={() => setScopeExportOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="export-options-formats">
            <section className="card export-format-card" aria-labelledby="scope-markdown-export-title">
              <div>
                <h3 id="scope-markdown-export-title">Markdown</h3>
                <p>
                  Readable task list for{" "}
                  {targetProjectId === null ? "Inbox" : (scopeProject?.title ?? taskTargetLabel)}.
                </p>
              </div>
              <div className="export-format-actions">
                <button
                  type="button"
                  onClick={() =>
                    setMarkdownModal({
                      title: targetProjectId === null ? "Inbox" : taskTargetLabel,
                      markdown,
                      format: "markdown",
                    })
                  }
                >
                  <Eye size={16} aria-hidden="true" />
                  Preview markdown
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // После успешного копирования показываем короткий статус пользователю.
                    await copyText(markdown);
                    setCopyStatus("Markdown copied");
                  }}
                >
                  <ClipboardCopy size={16} aria-hidden="true" />
                  Copy markdown
                </button>
              </div>
            </section>
            <section
              className="card export-format-card"
              aria-labelledby="scope-advanced-markdown-export-title"
            >
              <div>
                <h3 id="scope-advanced-markdown-export-title">Advanced markdown</h3>
                <p>Includes descriptions, due dates, labels, and comments.</p>
              </div>
              <div className="export-format-actions">
                <button
                  type="button"
                  onClick={() =>
                    setMarkdownModal({
                      title: targetProjectId === null ? "Inbox" : taskTargetLabel,
                      markdown: advancedMarkdown,
                      format: "advanced-markdown",
                    })
                  }
                >
                  <Eye size={16} aria-hidden="true" />
                  Preview advanced markdown
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await copyText(advancedMarkdown);
                    setCopyStatus("Advanced markdown copied");
                  }}
                >
                  <ClipboardCopy size={16} aria-hidden="true" />
                  Copy advanced markdown
                </button>
              </div>
            </section>
            <section className="card export-format-card" aria-labelledby="scope-json-export-title">
              <div>
                <h3 id="scope-json-export-title">JSON</h3>
                <p>
                  Complete structured data with tasks, sections, dates, descriptions, labels, and comments.
                </p>
              </div>
              <div className="export-format-actions">
                <button
                  type="button"
                  onClick={() =>
                    setMarkdownModal({
                      title: targetProjectId === null ? "Inbox" : taskTargetLabel,
                      markdown: scopeJson,
                      format: "json",
                    })
                  }
                >
                  <Eye size={16} aria-hidden="true" />
                  Preview JSON
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await copyText(scopeJson);
                    setCopyStatus("JSON copied");
                  }}
                >
                  <ClipboardCopy size={16} aria-hidden="true" />
                  Copy JSON
                </button>
              </div>
            </section>
          </div>
          {copyStatus.length > 0 ? (
            <p className="export-copy-status" role="status">
              {copyStatus}
            </p>
          ) : null}
        </section>
      </div>
    ) : null}
  </>
);
