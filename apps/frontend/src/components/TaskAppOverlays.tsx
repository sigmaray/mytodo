import type { useFloating } from "@floating-ui/react";
import { FloatingFocusManager, FloatingOverlay } from "@floating-ui/react";
import type { Project, ProjectId, Section, TaskNode } from "@todoist-clone/domain";
import clsx from "clsx";
import { ClipboardCopy, Eye, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { copyText, createPlacementOptions } from "../taskAppUtils";

/**
 * Данные открытого предпросмотра Markdown или JSON.
 *
 * @typedef {Object} TaskAppMarkdownModal
 * @property {string} title - Данные «заголовок», используемые типом «TaskAppMarkdownModal».
 * @property {string} markdown - Данные «Markdown», используемые типом «TaskAppMarkdownModal».
 * @property {"markdown" | "advanced-markdown" | "json"} [format] - Формат отображения или экспорта данных.
 */
export type TaskAppMarkdownModal = {
  title: string;

  markdown: string;

  format?: "markdown" | "advanced-markdown" | "json";
};

/**
 * @callback TaskAppOverlaysPropsSetSelectedMoveOpen
 * @param {boolean} open
 * @returns {void}
 */

/**
 * @callback TaskAppOverlaysPropsSetSelectedMovePlacement
 * @param {string} placement
 * @returns {void}
 */

/**
 * @callback TaskAppOverlaysPropsMoveSelectedTasks
 * @returns {void}
 */

/**
 * @callback TaskAppOverlaysPropsSetScopeExportOpen
 * @param {boolean} open
 * @returns {void}
 */

/**
 * @callback TaskAppOverlaysPropsSetCopyStatus
 * @param {string} status
 * @returns {void}
 */
/**
 * Состояние и действия модальных окон массового перемещения и экспорта.
 *
 * @typedef {Object} TaskAppOverlaysProps
 * @property {boolean} selectedMoveOpen - Признак, что диалог перемещения открыт.
 * @property {TaskAppOverlaysPropsSetSelectedMoveOpen} setSelectedMoveOpen - Открывает или закрывает диалог перемещения.
 * @property {Array<TaskNode>} selectedRootTasks - Выбранные корневые задачи.
 * @property {string} selectedMovePlacement - Место, выбранное для перемещения задач.
 * @property {TaskAppOverlaysPropsSetSelectedMovePlacement} setSelectedMovePlacement - Обновляет место назначения задач.
 * @property {Array<Project>} activeProjects - Активные проекты пользователя.
 * @property {Array<Section>} allSections - Все секции пользователя.
 * @property {boolean} selectedMovePending - Признак выполняющегося перемещения задач.
 * @property {TaskAppOverlaysPropsMoveSelectedTasks} moveSelectedTasks - Перемещает выбранные задачи.
 * @property {TaskAppMarkdownModal | null} markdownModal - Данные открытого Markdown-диалога.
 * @property {Dispatch<SetStateAction<TaskAppMarkdownModal | null>>} setMarkdownModal - Обновляет значение соответствующего состояния.
 * @property {ReturnType<typeof useFloating>} markdownFloating - Положение плавающего Markdown-диалога.
 * @property {boolean} scopeExportOpen - Признак, что диалог экспорта области открыт.
 * @property {TaskAppOverlaysPropsSetScopeExportOpen} setScopeExportOpen - Открывает или закрывает экспорт области.
 * @property {ProjectId | null} targetProjectId - Данные «target проект id», используемые типом «TaskAppOverlaysProps».
 * @property {Project | null} scopeProject - Проект, выбранный для экспорта.
 * @property {string} taskTargetLabel - Название выбранной области назначения задачи.
 * @property {string} markdown - Данные «Markdown», используемые типом «TaskAppOverlaysProps».
 * @property {string} advancedMarkdown - Содержимое расширенного Markdown-экспорта.
 * @property {string} scopeJson - Данные JSON-экспорта выбранной области.
 * @property {string} copyStatus - Состояние операции копирования.
 * @property {TaskAppOverlaysPropsSetCopyStatus} setCopyStatus - Обновляет результат копирования.
 */
type TaskAppOverlaysProps = {
  selectedMoveOpen: boolean;

  setSelectedMoveOpen: (open: boolean) => void;

  selectedRootTasks: Array<TaskNode>;

  selectedMovePlacement: string;

  setSelectedMovePlacement: (placement: string) => void;

  activeProjects: Array<Project>;

  allSections: Array<Section>;

  selectedMovePending: boolean;

  moveSelectedTasks: () => void;

  markdownModal: TaskAppMarkdownModal | null;

  setMarkdownModal: Dispatch<SetStateAction<TaskAppMarkdownModal | null>>;

  markdownFloating: ReturnType<typeof useFloating>;

  scopeExportOpen: boolean;

  setScopeExportOpen: (open: boolean) => void;

  targetProjectId: ProjectId | null;

  scopeProject: Project | null;

  taskTargetLabel: string;

  markdown: string;

  advancedMarkdown: string;

  scopeJson: string;

  copyStatus: string;

  setCopyStatus: (status: string) => void;
};

/**
 * Отображает модальные окна экспорта и массового перемещения задач.
 *
 * @param {TaskAppOverlaysProps} parameter1
 */
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
          /** Клик по фону отменяет массовое перемещение, клик внутри формы — нет. */
          if (event.target === event.currentTarget) setSelectedMoveOpen(false);
        }}
      >
        <section
          className="selection-move-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Move selected tasks"
          onKeyDown={(event) => {
            /** Escape закрывает диалог массового перемещения. */
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
                /** Закрытие предпросмотра освобождает focus manager от текущего диалога. */
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
          /** Закрываем настройки экспорта только по клику на затемнённый фон. */
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
              /** Escape закрывает список вариантов, не меняя открытое окно предпросмотра. */
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
                    /** После успешного копирования показываем короткий статус пользователю. */
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
