import type { DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FloatingFocusManager, FloatingOverlay, useFloating } from "@floating-ui/react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { BrowserRouter, Link, Navigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { Project, ProjectId, Section, SectionId, Task, TaskId, TaskNode } from "@todoist-clone/domain";
import {
  computeDropPlacement,
  computeIndentPlacement,
  computeOutdentPlacement,
  renderAdvancedMarkdownDocument,
  renderTaskMarkdownDocument,
} from "@todoist-clone/domain";
import clsx from "clsx";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Edit3,
  Eye,
  GripVertical,
  ListChecks,
  MessageSquare,
  MoveRight,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  DragEvent,
  FormEvent,
  KeyboardEvent,
  ReactElement,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./vendor/bootstrap.min.css";
import { createTaskApi, createToolsApi } from "./api";
import { AddTaskDialog } from "./components/AddTaskDialog";
import { AppSidebar } from "./components/AppSidebar";
import { formatAttachmentSize } from "./components/CommentAttachment";
import { TaskCommentsPanel } from "./components/TaskCommentsPanel";
import {
  AutoGrowTextarea,
  buildCalendarDays,
  calendarMonthLabel,
  calendarWeekdays,
  DatePickerPanel,
  LabelPicker,
  normalizeLabels,
  shiftCalendarMonth,
} from "./components/TaskFormFields";
import { isTaskDueToday, taskDueDateTone, toLocalIsoDate } from "./dateUtils";
import { appendById, removeById, replaceById } from "./queryData";
import {
  authStatusQueryKey,
  inboxDescriptionQueryKey,
  projectQueryKey,
  sectionQueryKey,
  settingsQueryKey,
  taskQueryKey,
} from "./queryKeys";
import { flattenTaskNodes } from "./taskTreeUtils";

const ToolsPage = lazy(() => import("./pages/ToolsPage").then((page) => ({ default: page.ToolsPage })));
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((page) => ({ default: page.SettingsPage })),
);
const AdminUsersPage = lazy(() =>
  import("./pages/AdminUsersPage").then((page) => ({ default: page.AdminUsersPage })),
);
const ArchivedProjectsPage = lazy(() =>
  import("./pages/ArchivedProjectsPage").then((page) => ({ default: page.ArchivedProjectsPage })),
);
const LoginPage = lazy(() => import("./pages/LoginPage").then((page) => ({ default: page.LoginPage })));

import type { ApplicationApi } from "./api";
import "./App.css";

const pastedFiles = (clipboardData: DataTransfer): ReadonlyArray<File> => {
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return Object.freeze(itemFiles.length > 0 ? itemFiles : Array.from(clipboardData.files));
};

const notifyAttachedFiles = (files: ReadonlyArray<File>) =>
  files.forEach((file) => toast.success(`Файл «${file.name}» прикреплён`));

type DragPlacement = "before" | "inside" | "after" | "outdent";
type MobileDragItem = Readonly<{ id: string }>;

type DropZoneId = "inbox" | `project:${ProjectId}` | `section:${SectionId}`;

type ActiveDragTarget = Readonly<{
  taskId: TaskId;
  placement: DragPlacement;
}>;

type TaskContextMenuState = Readonly<{
  task: TaskNode;
  left: number;
  top: number;
}>;

type MoveInput = Readonly<{
  taskId: TaskId;
  projectId: ProjectId | null;
  sectionId: SectionId | null;
  parentId: TaskId | null;
  beforeId: TaskId | null;
  afterId: TaskId | null;
}>;

const renderTaskNodes = (
  tasks: ReadonlyArray<TaskNode>,
  actions: Readonly<{
    toggleTask: (task: TaskNode) => void;
    startEditing: (task: TaskNode) => void;
    openDetails: (task: TaskNode) => void;
    openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => void;
    selectionMode: boolean;
    attachmentsEnabled: boolean;
    selectedTaskIds: ReadonlyArray<TaskId>;
    toggleTaskSelection: (task: TaskNode) => void;
    deleteTask: (task: TaskNode) => void;
    startSubtask: (task: TaskNode) => void;
    submitSubtask: (task: TaskNode) => void;
    cancelSubtask: () => void;
    moveTaskOntoTask: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    markDragTarget: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    clearDragTarget: () => void;
    finishDragging: () => void;
    startDragging: (task: TaskNode) => (event: DragEvent<HTMLElement>) => void;
    startMobileTaskDrag: (task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => void;
    moveMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    finishMobileDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    cancelMobileDrag: () => void;
    handleTaskKeys: (task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => void;
    submitEdit: (task: TaskNode) => void;
    cancelEdit: () => void;
    editTaskId: string | null;
    editTitle: string;
    editPlacement: string;
    subtaskParentId: string | null;
    subtaskTitle: string;
    draggingTaskId: string | null;
    activeDragTarget: ActiveDragTarget | null;
    placementOptions: ReadonlyArray<Readonly<{ value: string; label: string }>>;
    setEditTitle: (title: string) => void;
    setEditPlacement: (placement: string) => void;
    setSubtaskTitle: (title: string) => void;
  }>,
  depth = 0,
): ReactElement => (
  <ul className={depth === 0 ? "task-list" : "task-children"}>
    {tasks.map((task) => (
      <li key={task.id} className="task-item">
        <div
          className={clsx(
            "task-row",
            actions.selectionMode && "selection-mode",
            actions.selectedTaskIds.includes(task.id) && "selection-selected",
            actions.draggingTaskId === task.id && "dragging",
            actions.activeDragTarget?.taskId === task.id && [
              "drag-target",
              `drag-${actions.activeDragTarget.placement}`,
            ],
          )}
          data-task-id={task.id}
          data-task-depth={depth}
          tabIndex={0}
          draggable
          onDragStart={actions.startDragging(task)}
          onDragEnd={actions.finishDragging}
          onDragEnter={actions.markDragTarget(task)}
          onDragOver={actions.markDragTarget(task)}
          onDragLeave={actions.clearDragTarget}
          onDrop={actions.moveTaskOntoTask(task)}
          onKeyDown={actions.handleTaskKeys(task)}
          onClick={() => {
            if (actions.selectionMode) actions.toggleTaskSelection(task);
          }}
          onContextMenu={actions.openContextMenu(task)}
          style={{ paddingLeft: `${depth * 1.25}rem` }}
        >
          <input
            aria-label={`Complete ${task.title}`}
            checked={task.completed}
            type="checkbox"
            onChange={() => actions.toggleTask(task)}
          />
          {actions.editTaskId === task.id ? (
            <form
              className="edit-panel"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  actions.cancelEdit();
                }
              }}
              onSubmit={(event) => {
                event.preventDefault();
                actions.submitEdit(task);
              }}
            >
              <label>
                Title
                <AutoGrowTextarea
                  ariaLabel={`Edit ${task.title}`}
                  autoFocus
                  value={actions.editTitle}
                  onChange={actions.setEditTitle}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      actions.submitEdit(task);
                    }
                  }}
                />
              </label>
              <label>
                Location
                <select
                  aria-label={`Move ${task.title} to`}
                  value={actions.editPlacement}
                  onChange={(event) => actions.setEditPlacement(event.target.value)}
                >
                  {actions.placementOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="edit-panel-actions">
                <button type="submit">Save</button>
                <button type="button" onClick={actions.cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="task-content">
              <button
                type="button"
                className="mobile-task-drag-handle"
                aria-label={`Drag task ${task.title}`}
                onPointerDown={actions.startMobileTaskDrag(task)}
                onPointerMove={actions.moveMobileDrag}
                onPointerUp={actions.finishMobileDrag}
                onPointerCancel={actions.cancelMobileDrag}
              >
                <GripVertical size={16} aria-hidden="true" />
              </button>
              {actions.selectionMode && depth === 0 ? (
                <span className="task-selection-indicator" aria-hidden="true">
                  {actions.selectedTaskIds.includes(task.id) ? "✓" : ""}
                </span>
              ) : null}
              <button
                type="button"
                className={task.completed ? "task-title completed" : "task-title"}
                aria-pressed={actions.selectionMode ? actions.selectedTaskIds.includes(task.id) : undefined}
                onClick={() => {
                  if (!actions.selectionMode) actions.openDetails(task);
                }}
              >
                {task.title}
              </button>
              {task.description.trim() ? (
                <span className="task-description-preview" title={task.description}>
                  {task.description}
                </span>
              ) : null}
              {task.dueDate || task.labels.length > 0 || task.comments.length > 0 ? (
                <span className="task-meta-list">
                  {task.dueDate ? (
                    <time
                      className={taskDueDateTone(task.dueDate)}
                      dateTime={task.dueDate}
                      title={`Due ${task.dueDate}`}
                    >
                      <CalendarDays size={14} aria-hidden="true" />
                      <span>{isTaskDueToday(task.dueDate) ? "today" : task.dueDate}</span>
                    </time>
                  ) : null}
                  {task.labels.map((label) => (
                    <a className="task-label" key={label} href={`/labels?label=${encodeURIComponent(label)}`}>
                      {label}
                    </a>
                  ))}
                  {task.comments.length > 0 ? (
                    <span
                      className="task-comment-count"
                      aria-label={`${task.comments.length} ${task.comments.length === 1 ? "comment" : "comments"}`}
                      title={`${task.comments.length} ${task.comments.length === 1 ? "comment" : "comments"}`}
                    >
                      <MessageSquare size={14} aria-hidden="true" />
                      <span aria-hidden="true">{task.comments.length}</span>
                    </span>
                  ) : null}
                  {actions.attachmentsEnabled &&
                  task.comments.some((comment) => (comment.attachments?.length ?? 0) > 0) ? (
                    <span
                      className="task-attachment-indicator"
                      aria-label="Task has attachments"
                      title="Attachments"
                    >
                      <Paperclip size={14} aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          )}
          <button
            type="button"
            className="task-action"
            aria-label={`Edit task ${task.title}`}
            onClick={() => actions.startEditing(task)}
          >
            <Edit3 size={14} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            className="task-action"
            aria-label={`Add subtask to ${task.title}`}
            onClick={() => actions.startSubtask(task)}
          >
            <Plus size={14} aria-hidden="true" />
            Subtask
          </button>
          <button
            type="button"
            className="task-action danger"
            aria-label={`Delete task ${task.title}`}
            onClick={() => actions.deleteTask(task)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
        {actions.subtaskParentId === task.id ? (
          <form
            className="subtask-form"
            style={{ marginLeft: `${depth * 1.25 + 2.1}rem` }}
            onSubmit={(event) => {
              event.preventDefault();
              actions.submitSubtask(task);
            }}
          >
            <label htmlFor={`subtask-${task.id}`}>Subtask for {task.title}</label>
            <AutoGrowTextarea
              id={`subtask-${task.id}`}
              ariaLabel={`Subtask for ${task.title}`}
              autoFocus
              value={actions.subtaskTitle}
              onChange={actions.setSubtaskTitle}
              placeholder="Add a subtask"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  actions.submitSubtask(task);
                }
              }}
            />
            <button type="submit">Add subtask</button>
            <button type="button" onClick={actions.cancelSubtask}>
              Cancel
            </button>
          </form>
        ) : null}
        {task.children.length > 0 ? renderTaskNodes(task.children, actions, depth + 1) : null}
      </li>
    ))}
  </ul>
);

const inboxPlacement = "inbox";
const projectPlacement = (id: ProjectId) => `project:${id}`;
const sectionPlacement = (id: SectionId) => `section:${id}`;

const taskPlacement = (task: TaskNode) =>
  task.sectionId !== null
    ? sectionPlacement(task.sectionId)
    : task.projectId !== null
      ? projectPlacement(task.projectId)
      : inboxPlacement;

const parsePlacement = (
  placement: string,
  sections: ReadonlyArray<Section>,
): Readonly<{ projectId: ProjectId | null; sectionId: SectionId | null }> => {
  if (placement.startsWith("project:")) {
    return Object.freeze({ projectId: placement.slice("project:".length), sectionId: null });
  }

  if (placement.startsWith("section:")) {
    const sectionId = placement.slice("section:".length);
    return Object.freeze({
      projectId: sections.find((section) => section.id === sectionId)?.projectId ?? null,
      sectionId,
    });
  }

  return Object.freeze({ projectId: null, sectionId: null });
};

const createPlacementOptions = (
  projects: ReadonlyArray<Project>,
  sections: ReadonlyArray<Section>,
): ReadonlyArray<Readonly<{ value: string; label: string }>> =>
  Object.freeze(
    [
      Object.freeze({ value: inboxPlacement, label: "Inbox" }),
      ...sections.map((section) => {
        const projectTitle =
          section.projectId === null
            ? "Inbox"
            : (projects.find((project) => project.id === section.projectId)?.title ?? "Project");
        return Object.freeze({
          value: sectionPlacement(section.id),
          label: `${projectTitle} / ${section.title}`,
        });
      }),
      ...projects.map((project) =>
        Object.freeze({ value: projectPlacement(project.id), label: project.title }),
      ),
    ].sort(
      (left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: "base" }) ||
        left.value.localeCompare(right.value),
    ),
  );

const findTaskNode = (tasks: ReadonlyArray<TaskNode>, id: string): TaskNode | null =>
  tasks.reduce<TaskNode | null>(
    (found, task) => found ?? (task.id === id ? task : findTaskNode(task.children, id)),
    null,
  );

const filterTaskTree = (
  tasks: ReadonlyArray<TaskNode>,
  predicate: (task: TaskNode) => boolean,
): ReadonlyArray<TaskNode> =>
  Object.freeze(
    tasks.flatMap((task) => {
      if (predicate(task)) return [task];
      return filterTaskTree(task.children, predicate);
    }),
  );

const hasDescendant = (task: TaskNode, id: string): boolean =>
  task.children.some((child) => child.id === id || hasDescendant(child, id));

const dragPlacementFromEvent = (event: DragEvent<HTMLElement>): DragPlacement => {
  const { top, left, height } = event.currentTarget.getBoundingClientRect();
  const pointerX = Number.isFinite(event.clientX) ? event.clientX : left;
  const pointerY = Number.isFinite(event.clientY) ? event.clientY : 0;
  const virtualY = Number.isFinite(height) && height > 0 ? null : pointerY;
  const y = pointerY - (Number.isFinite(top) ? top : 0);
  const indent = Number.parseFloat(event.currentTarget.style.paddingLeft || "0");
  const depth = Number.parseInt(event.currentTarget.dataset.taskDepth ?? "0", 10);

  if ((Number.isFinite(left) && pointerX < left - 18) || (pointerX <= 0 && (indent > 0 || depth > 0))) {
    return "outdent";
  }

  if (virtualY !== null) {
    return virtualY < 35 ? "before" : virtualY > 65 ? "after" : "inside";
  }

  return y < height * 0.35 ? "before" : y > height * 0.65 ? "after" : "inside";
};

const currentMarkdown = (
  title: string,
  inboxRootTasks: ReadonlyArray<TaskNode>,
  sections: ReadonlyArray<Section>,
  allTasks: ReadonlyArray<TaskNode>,
  targetProjectId: ProjectId | null,
) => {
  if (targetProjectId !== null) {
    return renderTaskMarkdownDocument(
      title,
      allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null),
      sections
        .filter((section) => section.projectId === targetProjectId)
        .map((section) =>
          Object.freeze({
            title: section.title,
            tasks: allTasks.filter(
              (task) => task.projectId === targetProjectId && task.sectionId === section.id,
            ),
          }),
        ),
    );
  }

  return renderTaskMarkdownDocument(
    "Inbox",
    inboxRootTasks,
    sections
      .filter((section) => section.projectId === null)
      .map((section) =>
        Object.freeze({
          title: section.title,
          tasks: allTasks.filter((task) => task.projectId === null && task.sectionId === section.id),
        }),
      ),
  );
};

const currentAdvancedMarkdown = (
  title: string,
  sections: ReadonlyArray<Section>,
  allTasks: ReadonlyArray<TaskNode>,
  targetProjectId: ProjectId | null,
  description: string,
) =>
  renderAdvancedMarkdownDocument(
    title,
    allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null),
    sections
      .filter((section) => section.projectId === targetProjectId)
      .map((section) =>
        Object.freeze({
          title: section.title,
          tasks: allTasks.filter(
            (task) => task.projectId === targetProjectId && task.sectionId === section.id,
          ),
        }),
      ),
    description,
  );

const allMarkdownDocument = (
  projects: ReadonlyArray<Project>,
  sections: ReadonlyArray<Section>,
  tasks: ReadonlyArray<TaskNode>,
) =>
  renderTaskMarkdownDocument(
    "All tasks",
    [],
    [
      Object.freeze({
        title: "Inbox",
        tasks: tasks.filter((task) => task.projectId === null && task.sectionId === null),
      }),
      ...sections
        .filter((section) => section.projectId === null)
        .map((section) =>
          Object.freeze({
            title: `Inbox / ${section.title}`,
            tasks: tasks.filter((task) => task.projectId === null && task.sectionId === section.id),
          }),
        ),
      ...projects.flatMap((project) => [
        Object.freeze({
          title: project.title,
          tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === null),
        }),
        ...sections
          .filter((section) => section.projectId === project.id)
          .map((section) =>
            Object.freeze({
              title: `${project.title} / ${section.title}`,
              tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === section.id),
            }),
          ),
      ]),
    ],
  );

const allAdvancedMarkdownDocument = (
  projects: ReadonlyArray<Project>,
  sections: ReadonlyArray<Section>,
  tasks: ReadonlyArray<TaskNode>,
  inboxDescription: string,
) =>
  renderAdvancedMarkdownDocument(
    "All tasks",
    [],
    [
      Object.freeze({
        title: "Inbox",
        description: inboxDescription,
        tasks: tasks.filter((task) => task.projectId === null && task.sectionId === null),
      }),
      ...sections
        .filter((section) => section.projectId === null)
        .map((section) =>
          Object.freeze({
            title: `Inbox / ${section.title}`,
            tasks: tasks.filter((task) => task.projectId === null && task.sectionId === section.id),
          }),
        ),
      ...projects.flatMap((project) => [
        Object.freeze({
          title: project.title,
          description: project.description,
          tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === null),
        }),
        ...sections
          .filter((section) => section.projectId === project.id)
          .map((section) =>
            Object.freeze({
              title: `${project.title} / ${section.title}`,
              tasks: tasks.filter((task) => task.projectId === project.id && task.sectionId === section.id),
            }),
          ),
      ]),
    ],
  );

const copyText = async (text: string) => {
  if (navigator.clipboard !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const TaskApp = ({
  api,
  attachmentsEnabled = false,
  projectArchivingEnabled = false,
}: Readonly<{ api: ApplicationApi; attachmentsEnabled?: boolean; projectArchivingEnabled?: boolean }>) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [dateView, setDateView] = useState<"list" | "calendar">("list");
  const [dateListFilter, setDateListFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [activeCalendarDate, setActiveCalendarDate] = useState<string | null>(null);
  const calendarDraggedTaskRef = useRef<TaskId | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskDescription, setAddTaskDescription] = useState("");
  const [addTaskFiles, setAddTaskFiles] = useState<ReadonlyArray<File>>(Object.freeze([]));
  const [addTaskDate, setAddTaskDate] = useState("");
  const [addTaskDatePickerOpen, setAddTaskDatePickerOpen] = useState(false);
  const [addTaskDateBeforePicker, setAddTaskDateBeforePicker] = useState("");
  const [addTaskLabels, setAddTaskLabels] = useState<ReadonlyArray<string>>(Object.freeze([]));
  const [addTaskLabelInput, setAddTaskLabelInput] = useState("");
  const [showAddTaskDescription, setShowAddTaskDescription] = useState(false);
  const [showAddTaskDate, setShowAddTaskDate] = useState(false);
  const [showAddTaskLabels, setShowAddTaskLabels] = useState(false);
  const [addTaskPlacement, setAddTaskPlacement] = useState(inboxPlacement);
  const [sectionTitle, setSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [editSectionId, setEditSectionId] = useState<SectionId | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [activeDragTarget, setActiveDragTarget] = useState<ActiveDragTarget | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<DropZoneId | null>(null);
  const mobileDragRef = useRef<MobileDragItem | null>(null);
  const [activeSectionDrop, setActiveSectionDrop] = useState<Readonly<{
    id: SectionId;
    position: "before" | "after";
  }> | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<SectionId | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<ProjectId | null>(() =>
    new URLSearchParams(window.location.search).get("project"),
  );
  const [targetSectionId, setTargetSectionId] = useState<SectionId | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPlacement, setEditPlacement] = useState(inboxPlacement);
  const [markdownModal, setMarkdownModal] = useState<Readonly<{
    title: string;
    markdown: string;
    format?: "markdown" | "advanced-markdown" | "json";
  }> | null>(null);
  const [scopeExportOpen, setScopeExportOpen] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState<TaskId | null>(null);
  const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenuState | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRootTaskIds, setSelectedRootTaskIds] = useState<ReadonlyArray<TaskId>>(Object.freeze([]));
  const [selectedMoveOpen, setSelectedMoveOpen] = useState(false);
  const [selectedMovePlacement, setSelectedMovePlacement] = useState(inboxPlacement);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailDueDate, setDetailDueDate] = useState("");
  const [detailLabelInput, setDetailLabelInput] = useState("");
  const [detailSaveStatus, setDetailSaveStatus] = useState("");
  const [detailProjectId, setDetailProjectId] = useState<ProjectId | null>(null);
  const [detailSectionId, setDetailSectionId] = useState<SectionId | null>(null);
  const [editingDetailField, setEditingDetailField] = useState<"title" | "description" | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showMobileLabels, setShowMobileLabels] = useState(false);
  const [showMobileComments, setShowMobileComments] = useState(false);
  const [showMobileDate, setShowMobileDate] = useState(false);
  const [showMobileSubtasks, setShowMobileSubtasks] = useState(false);
  const subtasksSectionRef = useRef<HTMLElement>(null);
  const sectionCreateInputRef = useRef<HTMLInputElement>(null);
  const [detailComment, setDetailComment] = useState("");
  const [detailCommentFiles, setDetailCommentFiles] = useState<ReadonlyArray<File>>(Object.freeze([]));
  const pastedCommentSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [detailSubtask, setDetailSubtask] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [openProjectMenuId, setOpenProjectMenuId] = useState<ProjectId | null>(null);
  const [editingScopeDescription, setEditingScopeDescription] = useState(false);
  const [scopeDescriptionDraft, setScopeDescriptionDraft] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const queryClient = useQueryClient();
  const markdownFloating = useFloating({ open: markdownModal !== null });
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: Object.freeze({ distance: 4 }) }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (taskContextMenu === null) return;
    const dismiss = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".task-context-menu"))
        setTaskContextMenu(null);
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setTaskContextMenu(null);
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [taskContextMenu]);

  useEffect(() => {
    if (addingSection) sectionCreateInputRef.current?.focus();
  }, [addingSection]);
  useLayoutEffect(() => {
    if (showMobileSubtasks)
      subtasksSectionRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [showMobileSubtasks]);
  useEffect(() => {
    if (openProjectMenuId === null) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".project-menu") === null) setOpenProjectMenuId(null);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpenProjectMenuId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openProjectMenuId]);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && scopeExportOpen && markdownModal === null) setScopeExportOpen(false);
      if (
        event.key === "Escape" &&
        detailsTaskId !== null &&
        editingDetailField === null &&
        !datePickerOpen &&
        detailLabelInput === ""
      )
        setDetailsTaskId(null);
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (
        !isTyping &&
        detailsTaskId === null &&
        markdownModal === null &&
        !scopeExportOpen &&
        !addTaskOpen &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        ["q", "й"].includes(event.key.toLocaleLowerCase())
      ) {
        event.preventDefault();
        setAddTaskPlacement(
          currentPath === "/"
            ? targetSectionId === null
              ? targetProjectId === null
                ? inboxPlacement
                : projectPlacement(targetProjectId)
              : sectionPlacement(targetSectionId)
            : inboxPlacement,
        );
        setAddTaskPlacement(
          currentPath === "/"
            ? targetSectionId === null
              ? targetProjectId === null
                ? inboxPlacement
                : projectPlacement(targetProjectId)
              : sectionPlacement(targetSectionId)
            : inboxPlacement,
        );
        setAddTaskTitle("");
        setAddTaskDescription("");
        setAddTaskDate("");
        setAddTaskLabels(Object.freeze([]));
        setAddTaskLabelInput("");
        setShowAddTaskDescription(false);
        setShowAddTaskDate(false);
        setShowAddTaskLabels(false);
        setAddTaskOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    detailsTaskId,
    markdownModal,
    scopeExportOpen,
    addTaskOpen,
    editingDetailField,
    datePickerOpen,
    detailLabelInput,
    targetProjectId,
    targetSectionId,
    currentPath,
  ]);
  useEffect(() => {
    if (!attachmentsEnabled || (!addTaskOpen && detailsTaskId === null)) return;
    const attachPastedFiles = (event: globalThis.ClipboardEvent) => {
      if (event.clipboardData === null) return;
      const files = pastedFiles(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (addTaskOpen) {
        const acceptedFiles = files.slice(0, Math.max(0, 10 - addTaskFiles.length));
        setAddTaskFiles(Object.freeze([...addTaskFiles, ...acceptedFiles]));
        notifyAttachedFiles(acceptedFiles);
        return;
      }
      if (detailsTaskId === null) return;
      const acceptedFiles = files.slice(0, 10);
      const commentBody = detailComment.trim();
      pastedCommentSaveQueueRef.current = pastedCommentSaveQueueRef.current
        .then(async () => {
          await api.createComment(detailsTaskId, commentBody, acceptedFiles);
          notifyAttachedFiles(acceptedFiles);
          if (commentBody.length > 0)
            setDetailComment((current) => (current.trim() === commentBody ? "" : current));
          await queryClient.invalidateQueries({ queryKey: taskQueryKey });
        })
        .catch(() => {
          setDetailCommentFiles((current) => Object.freeze([...current, ...acceptedFiles].slice(0, 10)));
          acceptedFiles.forEach((file) => toast.error(`Не удалось сохранить файл «${file.name}»`));
        });
    };
    document.addEventListener("paste", attachPastedFiles, true);
    return () => document.removeEventListener("paste", attachPastedFiles, true);
  }, [attachmentsEnabled, addTaskOpen, addTaskFiles, detailsTaskId, detailComment, api, queryClient]);
  const tasks = useQuery({
    queryKey: taskQueryKey,
    queryFn: api.listTasks,
  });

  const projects = useQuery({
    queryKey: projectQueryKey,
    queryFn: api.listProjects,
  });

  const sections = useQuery({
    queryKey: sectionQueryKey,
    queryFn: api.listSections,
  });

  const settings = useQuery({
    queryKey: settingsQueryKey,
    queryFn: api.getSettings,
  });
  const inboxDescriptionQuery = useQuery({
    queryKey: inboxDescriptionQueryKey,
    queryFn: api.getInboxDescription,
  });

  const confirmDeletion = (message: string) =>
    settings.data?.confirmDelete === false || window.confirm(message);

  const createSubtaskMutation = useMutation({
    mutationFn: (subtask: Readonly<{ title: string; parent: TaskNode }>) =>
      api.createTask(subtask.title, subtask.parent.projectId, subtask.parent.sectionId, subtask.parent.id),
    onSuccess: async () => {
      setSubtaskTitle("");
      setSubtaskParentId(null);
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (project: Readonly<{ id: ProjectId; title?: string; description?: string }>) =>
      api.updateProject(project.id, project),
    onSuccess: (project) => {
      queryClient.setQueryData(projectQueryKey, (current: ReadonlyArray<Project> | undefined) =>
        replaceById(current, project),
      );
    },
  });

  const reorderSectionMutation = useMutation({
    mutationFn: ({
      id,
      beforeId,
      afterId,
    }: Readonly<{ id: SectionId; beforeId: SectionId | null; afterId: SectionId | null }>) =>
      api.reorderSection(id, beforeId, afterId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sectionQueryKey });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: (input: Readonly<{ title: string; projectId: ProjectId | null }>) =>
      api.createSection(input.title, input.projectId),
    onSuccess: (section) => {
      setSectionTitle("");
      setAddingSection(false);
      queryClient.setQueryData(sectionQueryKey, (current: ReadonlyArray<Section> | undefined) =>
        appendById(current, section),
      );
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: (section: Readonly<{ id: SectionId; title: string }>) =>
      api.updateSection(section.id, section.title),
    onSuccess: (section) => {
      setEditSectionId(null);
      setEditSectionTitle("");
      queryClient.setQueryData(sectionQueryKey, (current: ReadonlyArray<Section> | undefined) =>
        replaceById(current, section),
      );
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (section: Section) => api.deleteSection(section.id).then(() => section),
    onSuccess: async (section) => {
      queryClient.setQueryData(sectionQueryKey, (current: ReadonlyArray<Section> | undefined) =>
        removeById(current, section.id),
      );
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const requestSectionDelete = (section: Section) => {
    if (confirmDeletion(`Delete section “${section.title}”?`)) {
      deleteSectionMutation.mutate(section);
    }
  };

  const toggleMutation = useMutation({
    mutationFn: (task: TaskNode) => api.patchTask(task.id, !task.completed),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKey });
      const previousTasks = queryClient.getQueryData<ReadonlyArray<TaskNode>>(taskQueryKey);

      const toggleNodes = (nodes: ReadonlyArray<TaskNode>): ReadonlyArray<TaskNode> =>
        Object.freeze(
          nodes.map((node) =>
            Object.freeze({
              ...node,
              completed: node.id === task.id ? !node.completed : node.completed,
              children: toggleNodes(node.children),
            }),
          ),
        );

      queryClient.setQueryData(taskQueryKey, toggleNodes(previousTasks ?? Object.freeze([])));

      return Object.freeze({ previousTasks });
    },
    onError: (_error, _task, context) => {
      queryClient.setQueryData(taskQueryKey, context?.previousTasks);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (task: TaskNode) => {
      const placement = parsePlacement(editPlacement, allSections);
      const titleTask = await api.updateTask(task.id, Object.freeze({ title: editTitle.trim() }));

      return taskPlacement(task) === editPlacement
        ? titleTask
        : api.moveTask(task.id, placement.projectId, placement.sectionId, null, null, null);
    },
    onSuccess: async () => {
      setEditTaskId(null);
      setEditTitle("");
      setEditPlacement(inboxPlacement);
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (task: TaskNode) => api.deleteTask(task.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const requestTaskDelete = (task: TaskNode) => {
    if (confirmDeletion(`Delete task “${task.title}” and its subtasks?`)) {
      deleteMutation.mutate(task);
    }
  };

  const moveMutation = useMutation({
    mutationFn: (placement: MoveInput) =>
      api.moveTask(
        placement.taskId,
        placement.projectId,
        placement.sectionId,
        placement.parentId,
        placement.beforeId,
        placement.afterId,
      ),
    onSuccess: async () => {
      setDraggingTaskId(null);
      setActiveDragTarget(null);
      setActiveDropZone(null);
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const selectedMoveMutation = useMutation({
    mutationFn: async (
      input: Readonly<{
        taskIds: ReadonlyArray<TaskId>;
        projectId: ProjectId | null;
        sectionId: SectionId | null;
      }>,
    ) => {
      for (const taskId of input.taskIds) {
        await api.moveTask(taskId, input.projectId, input.sectionId, null, null, null);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
      clearSelection();
    },
  });

  const selectedDeleteMutation = useMutation({
    mutationFn: async (taskIds: ReadonlyArray<TaskId>) =>
      Promise.all(taskIds.map((taskId) => api.deleteTask(taskId))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
      clearSelection();
    },
  });

  const submitSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = sectionTitle.trim();

    if (trimmed.length > 0) {
      createSectionMutation.mutate({ title: trimmed, projectId: targetProjectId });
    }
  };

  const cancelSectionCreate = () => {
    setAddingSection(false);
    setSectionTitle("");
  };

  const submitSectionEdit = (section: Section) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = editSectionTitle.trim();

    if (trimmed.length > 0) {
      updateSectionMutation.mutate(Object.freeze({ id: section.id, title: trimmed }));
    }
  };

  const startSectionEdit = (section: Section) => {
    setEditSectionId(section.id);
    setEditSectionTitle(section.title);
  };

  const startSubtask = (task: TaskNode) => {
    setSubtaskParentId(task.id);
    setSubtaskTitle("");
  };

  const submitSubtask = (task: TaskNode) => {
    const trimmed = subtaskTitle.trim();

    if (trimmed.length > 0) {
      createSubtaskMutation.mutate(Object.freeze({ title: trimmed, parent: task }));
    }
  };

  const dropZoneId = (projectId: ProjectId | null, sectionId: SectionId | null): DropZoneId =>
    sectionId !== null ? `section:${sectionId}` : projectId !== null ? `project:${projectId}` : "inbox";

  const markDropZone =
    (projectId: ProjectId | null, sectionId: SectionId | null) => (event: DragEvent<HTMLElement>) => {
      if (event.dataTransfer?.types && !event.dataTransfer.types.includes("text/task-id")) return;
      event.preventDefault();
      setActiveDropZone(dropZoneId(projectId, sectionId));
    };

  const moveDroppedTask =
    (projectId: ProjectId | null, sectionId: SectionId | null) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const taskId = event.dataTransfer.getData("text/task-id");
      const taskIdsJson = event.dataTransfer.getData("text/task-ids");

      if (taskId.length > 0) {
        if (taskIdsJson.length > 0) {
          try {
            const taskIds = JSON.parse(taskIdsJson) as ReadonlyArray<TaskId>;
            if (taskIds.length > 0)
              selectedMoveMutation.mutate(Object.freeze({ taskIds, projectId, sectionId }));
          } catch {
            moveMutation.mutate(
              Object.freeze({ taskId, projectId, sectionId, parentId: null, beforeId: null, afterId: null }),
            );
          }
        } else {
          moveMutation.mutate(
            Object.freeze({ taskId, projectId, sectionId, parentId: null, beforeId: null, afterId: null }),
          );
        }
      }
    };

  const startSectionDrag = (section: Section) => (event: DragEvent<HTMLElement>) => {
    setDraggingSectionId(section.id);
    event.dataTransfer.setData("application/x-section-id", section.id);
    event.dataTransfer.effectAllowed = "move";
  };
  const markSectionDrop = (section: Section) => (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("application/x-section-id") && draggingSectionId === null) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveSectionDrop(
      Object.freeze({
        id: section.id,
        position: event.clientY < rect.top + rect.height / 2 ? "before" : "after",
      }),
    );
  };
  const dropSection =
    (section: Section, siblings: ReadonlyArray<Section>) => (event: DragEvent<HTMLElement>) => {
      const draggedId = event.dataTransfer.getData("application/x-section-id") || draggingSectionId;
      if (!draggedId || draggedId === section.id) return;
      event.preventDefault();
      const position =
        event.clientY <
        event.currentTarget.getBoundingClientRect().top +
          event.currentTarget.getBoundingClientRect().height / 2
          ? "before"
          : "after";
      const ordered = siblings.filter((item) => item.id !== draggedId);
      const index = ordered.findIndex((item) => item.id === section.id);
      const beforeId = position === "before" ? section.id : (ordered[index + 1]?.id ?? null);
      const afterId = position === "before" ? (ordered[index - 1]?.id ?? null) : section.id;
      setDraggingSectionId(null);
      setActiveSectionDrop(null);
      reorderSectionMutation.mutate({ id: draggedId, beforeId, afterId });
    };
  const startMobileTaskDrag = (task: TaskNode) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    mobileDragRef.current = Object.freeze({ id: task.id });
    setDraggingTaskId(task.id);
    setActiveDragTarget(null);
    setActiveDropZone(null);
  };
  const moveMobileDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = mobileDragRef.current;
    if (drag === null) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!(target instanceof Element)) return;
    {
      const taskTarget = target.closest<HTMLElement>("[data-task-id]");
      const sectionTarget = target.closest<HTMLElement>("[data-mobile-drop-section]");
      const projectTarget = target.closest<HTMLElement>("[data-mobile-drop-project]");
      if (taskTarget !== null) {
        const targetTaskId = taskTarget.dataset.taskId ?? "";
        const targetTask = findTaskNode(allTasks, targetTaskId);
        const sourceTask = findTaskNode(allTasks, drag.id);
        if (
          targetTask !== null &&
          sourceTask !== null &&
          targetTask.id !== sourceTask.id &&
          !hasDescendant(sourceTask, targetTask.id)
        ) {
          const rect = taskTarget.getBoundingClientRect();
          const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
          const placement = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside";
          setActiveDragTarget(Object.freeze({ taskId: targetTask.id, placement }));
        } else setActiveDragTarget(null);
        setActiveDropZone(null);
      } else if (sectionTarget !== null) {
        const sectionId = sectionTarget.dataset.mobileDropSection;
        const section = allSections.find((item) => item.id === sectionId);
        setActiveDragTarget(null);
        if (section !== undefined) setActiveDropZone(dropZoneId(section.projectId, section.id));
      } else if (projectTarget !== null) {
        const projectId = projectTarget.dataset.mobileDropProject;
        setActiveDragTarget(null);
        setActiveDropZone(
          projectId === "inbox" ? inboxPlacement : projectId ? dropZoneId(projectId, null) : null,
        );
      } else {
        setActiveDragTarget(null);
        setActiveDropZone(null);
      }
    }
  };

  const finishMobileDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = mobileDragRef.current;
    mobileDragRef.current = null;
    if (drag === null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (target instanceof Element) {
      const moved = findTaskNode(allTasks, drag.id);
      const taskTarget = target.closest<HTMLElement>("[data-task-id]");
      const destinationSection = target.closest<HTMLElement>("[data-mobile-drop-section]");
      const destinationProject = target.closest<HTMLElement>("[data-mobile-drop-project]");
      if (moved !== null && taskTarget !== null) {
        const targetTask = findTaskNode(allTasks, taskTarget.dataset.taskId ?? "");
        if (targetTask !== null && targetTask.id !== moved.id && !hasDescendant(moved, targetTask.id)) {
          const rect = taskTarget.getBoundingClientRect();
          const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
          const placement = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside";
          const nextPlacement =
            placement === "inside"
              ? Object.freeze({
                  parentId: targetTask.id,
                  projectId: targetTask.projectId,
                  sectionId: targetTask.sectionId,
                  beforeId: null,
                  afterId: null,
                })
              : computeDropPlacement(flatTasks, moved, targetTask, placement);
          if (nextPlacement !== null)
            moveMutation.mutate(Object.freeze({ taskId: moved.id, ...nextPlacement }));
        }
      } else if (moved !== null && destinationSection !== null) {
        moveMutation.mutate(
          Object.freeze({
            taskId: moved.id,
            projectId: moved.projectId,
            sectionId: destinationSection.dataset.mobileDropSection ?? null,
            parentId: null,
            beforeId: null,
            afterId: null,
          }),
        );
      } else if (moved !== null && destinationProject !== null) {
        const projectId =
          destinationProject.dataset.mobileDropProject === "inbox"
            ? null
            : (destinationProject.dataset.mobileDropProject ?? null);
        moveMutation.mutate(
          Object.freeze({
            taskId: moved.id,
            projectId,
            sectionId: null,
            parentId: null,
            beforeId: null,
            afterId: null,
          }),
        );
      }
    }
    setDraggingTaskId(null);
    setActiveDragTarget(null);
    setActiveDropZone(null);
  };

  const cancelMobileDrag = () => {
    mobileDragRef.current = null;
    setDraggingTaskId(null);
    setActiveDragTarget(null);
    setActiveDropZone(null);
  };

  const dropTaskOnCalendarDate = (date: string) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/task-id") || calendarDraggedTaskRef.current;
    calendarDraggedTaskRef.current = null;
    setActiveCalendarDate(null);
    setActiveDropZone(null);
    if (!taskId) return;
    void api
      .updateTask(taskId, { dueDate: date })
      .then(() => queryClient.invalidateQueries({ queryKey: taskQueryKey }));
  };
  const markCalendarDate = (date: string) => (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("text/task-id") && calendarDraggedTaskRef.current === null) return;
    event.preventDefault();
    setActiveCalendarDate(date);
  };

  const _allowDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const startDragging = (task: TaskNode) => (event: DragEvent<HTMLElement>) => {
    setDraggingTaskId(task.id);
    setActiveDropZone(null);
    event.dataTransfer.setData("text/task-id", task.id);
    if (selectionMode && selectedRootTaskIds.includes(task.id)) {
      event.dataTransfer.setData("text/task-ids", JSON.stringify(selectedRootTaskIds));
    }
  };

  const moveTaskOntoTask = (target: TaskNode) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const taskId = event.dataTransfer.getData("text/task-id");
    const taskIdsJson = event.dataTransfer.getData("text/task-ids");
    if (taskIdsJson.length > 0) {
      try {
        const taskIds = JSON.parse(taskIdsJson) as ReadonlyArray<TaskId>;
        selectedMoveMutation.mutate(
          Object.freeze({ taskIds, projectId: target.projectId, sectionId: target.sectionId }),
        );
        return;
      } catch {
        // Fall back to the existing single-task drop behavior for invalid payloads.
      }
    }
    const moved = findTaskNode(allTasks, taskId);

    if (moved === null || hasDescendant(moved, target.id)) {
      setDraggingTaskId(null);
      setActiveDragTarget(null);
      return;
    }

    const placement = dragPlacementFromEvent(event);
    const nextPlacement =
      placement === "outdent" || (moved.id === target.id && moved.parentId !== null)
        ? computeOutdentPlacement(flatTasks, moved)
        : moved.id === target.id
          ? null
          : placement === "inside"
            ? Object.freeze({
                parentId: target.id,
                projectId: target.projectId,
                sectionId: target.sectionId,
                beforeId: null,
                afterId: null,
              })
            : computeDropPlacement(flatTasks, moved, target, placement);

    if (nextPlacement !== null) {
      moveMutation.mutate(Object.freeze({ taskId, ...nextPlacement }));
      return;
    }

    setDraggingTaskId(null);
    setActiveDragTarget(null);
  };

  const markDragTarget = (task: TaskNode) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setActiveDragTarget(Object.freeze({ taskId: task.id, placement: dragPlacementFromEvent(event) }));
  };

  const moveByPlacement = (task: TaskNode, placement: ReturnType<typeof computeIndentPlacement>) => {
    if (placement !== null) {
      moveMutation.mutate(Object.freeze({ taskId: task.id, ...placement }));
    }
  };

  const handleTaskKeys = (task: TaskNode) => (event: KeyboardEvent<HTMLElement>) => {
    if (!(event.metaKey || event.ctrlKey) || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) {
      return;
    }

    event.preventDefault();
    moveByPlacement(
      task,
      event.key === "ArrowRight"
        ? computeIndentPlacement(flatTasks, task)
        : computeOutdentPlacement(flatTasks, task),
    );
  };

  const startEditing = (task: TaskNode) => {
    setEditTaskId(task.id);
    setEditTitle(task.title);
    setEditPlacement(taskPlacement(task));
  };

  const openDetails = (task: TaskNode) => {
    setDetailsTaskId(task.id);
    setDetailTitle(task.title);
    setDetailDescription(task.description);
    setDetailDueDate(task.dueDate ?? "");
    setDetailLabelInput("");
    setDetailSaveStatus("");
    setDetailProjectId(task.projectId);
    setDetailSectionId(task.sectionId);
    setEditingDetailField(null);
    setDatePickerOpen(false);
    setShowMobileLabels(false);
    setShowMobileComments(false);
    setShowMobileDate(false);
    setShowMobileSubtasks(false);
    setDetailComment("");
    setDetailSubtask("");
  };

  const submitEdit = (task: TaskNode) => {
    if (editTitle.trim().length === 0) {
      return;
    }

    editMutation.mutate(task);
  };

  const allTasks = tasks.data ?? Object.freeze([]);
  const flatTasks = flattenTaskNodes(allTasks);
  const scopeRootTasks = allTasks.filter(
    (task) => task.parentId === null && task.projectId === targetProjectId,
  );
  const selectedRootTasks = scopeRootTasks.filter((task) => selectedRootTaskIds.includes(task.id));
  const collectSelectedTaskIds = (task: TaskNode): ReadonlyArray<TaskId> =>
    Object.freeze([task.id, ...task.children.flatMap(collectSelectedTaskIds)]);
  const selectedTaskIds = Object.freeze(selectedRootTasks.flatMap(collectSelectedTaskIds));
  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedRootTaskIds(Object.freeze([]));
    setSelectedMoveOpen(false);
  };
  const rootTaskForSelection = (task: TaskNode): TaskNode => {
    if (task.parentId === null) return task;
    const parent = findTaskNode(allTasks, task.parentId);
    return parent === null ? task : rootTaskForSelection(parent);
  };
  const toggleTaskSelection = (task: TaskNode) => {
    if (!selectionMode) return;
    const rootTask = rootTaskForSelection(task);
    if (!scopeRootTasks.some((candidate) => candidate.id === rootTask.id)) return;
    setSelectedRootTaskIds((current) =>
      Object.freeze(
        current.includes(rootTask.id)
          ? current.filter((id) => id !== rootTask.id)
          : [...current, rootTask.id],
      ),
    );
  };
  const availableLabels = normalizeLabels(flatTasks.flatMap((task) => task.labels));
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("addTask") === "1") {
      setAddTaskPlacement(targetProjectId === null ? inboxPlacement : projectPlacement(targetProjectId));
      setAddTaskOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const taskId = new URLSearchParams(window.location.search).get("task");
    const task = taskId === null ? null : findTaskNode(allTasks, taskId);
    if (task !== null) {
      openDetails(task);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [allTasks, targetProjectId]);
  const allProjects = projects.data ?? Object.freeze([]);
  const activeProjects = allProjects.filter((project) => !projectArchivingEnabled || !project.archived);
  const allSections = sections.data ?? Object.freeze([]);
  const selectedDetailsTask = detailsTaskId === null ? null : findTaskNode(allTasks, detailsTaskId);
  const selectedDetailsProject =
    detailProjectId === null ? null : (allProjects.find((project) => project.id === detailProjectId) ?? null);
  const selectedDetailsSection =
    selectedDetailsTask?.sectionId === null || selectedDetailsTask?.sectionId === undefined
      ? null
      : (allSections.find((section) => section.id === selectedDetailsTask.sectionId) ?? null);
  const selectedDetailsParent =
    selectedDetailsTask?.parentId === null || selectedDetailsTask?.parentId === undefined
      ? null
      : findTaskNode(allTasks, selectedDetailsTask.parentId);
  const saveTaskDetails = async (patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<boolean> => {
    if (selectedDetailsTask === null) return false;
    setDetailSaveStatus("Saving…");
    try {
      const updatedTask = await api.updateTask(selectedDetailsTask.id, patch);
      queryClient.setQueryData<ReadonlyArray<TaskNode>>(taskQueryKey, (current) => {
        if (current === undefined) return current;
        const updateNode = (node: TaskNode): TaskNode =>
          node.id === updatedTask.id
            ? Object.freeze({ ...node, ...updatedTask, children: node.children })
            : Object.freeze({ ...node, children: node.children.map(updateNode) });
        return current.map(updateNode);
      });
      setDetailSaveStatus("Saved");
      return true;
    } catch {
      setDetailSaveStatus("Could not save changes");
      return false;
    }
  };
  const removeCommentAttachment = async (commentId: string, attachmentId: string) => {
    if (selectedDetailsTask === null || !attachmentsEnabled) return;
    const comments = selectedDetailsTask.comments.flatMap((comment) => {
      if (comment.id !== commentId) return [comment];
      const attachments = (comment.attachments ?? []).filter((attachment) => attachment.id !== attachmentId);
      if (!comment.body.trim() && attachments.length === 0) return [];
      return [Object.freeze({ ...comment, attachments: Object.freeze(attachments) })];
    });
    const commentWasRemoved = !comments.some((comment) => comment.id === commentId);
    if ((await saveTaskDetails({ comments })) && commentWasRemoved)
      setEditingCommentId((current) => (current === commentId ? null : current));
  };
  const closeMobileLabels = async () => {
    if (selectedDetailsTask === null) return;
    if (selectedDetailsTask.labels.length > 0 && !window.confirm("Remove all saved labels from this task?"))
      return;
    setShowMobileLabels(false);
    setDetailLabelInput("");
    if (selectedDetailsTask.labels.length > 0) await saveTaskDetails({ labels: [] });
  };
  const closeMobileComments = async () => {
    if (selectedDetailsTask === null) return;
    if (
      selectedDetailsTask.comments.length > 0 &&
      !window.confirm("Remove all saved comments from this task?")
    )
      return;
    setShowMobileComments(false);
    setDetailComment("");
    if (selectedDetailsTask.comments.length > 0) await saveTaskDetails({ comments: [] });
  };
  const closeMobileSubtasks = async () => {
    if (selectedDetailsTask === null) return;
    if (
      selectedDetailsTask.children.length > 0 &&
      !window.confirm("Delete all saved subtasks and their descendants?")
    )
      return;
    setShowMobileSubtasks(false);
    setDetailSubtask("");
    await Promise.all(selectedDetailsTask.children.map((child) => api.deleteTask(child.id)));
    if (selectedDetailsTask.children.length > 0)
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
  };
  const inboxSections = allSections.filter((section) => section.projectId === null);
  const projectSections = allSections.filter(
    (section) => section.projectId === targetProjectId && targetProjectId !== null,
  );
  const inboxRootTasks = allTasks.filter((task) => task.projectId === null && task.sectionId === null);
  const currentScopeDescription =
    targetProjectId === null
      ? (inboxDescriptionQuery.data ?? "")
      : (activeProjects.find((project) => project.id === targetProjectId)?.description ?? "");
  const startScopeDescriptionEdit = () => {
    setScopeDescriptionDraft(currentScopeDescription);
    setEditingScopeDescription(true);
  };
  const saveScopeDescription = async () => {
    const description = scopeDescriptionDraft.trim();
    if (targetProjectId === null) {
      await api.updateInboxDescription(description);
      await queryClient.invalidateQueries({ queryKey: inboxDescriptionQueryKey });
    } else {
      updateProjectMutation.mutate({ id: targetProjectId, description });
    }
    setEditingScopeDescription(false);
  };
  const removeScopeDescription = async () => {
    if (!confirmDeletion("Delete this description?")) return;
    if (targetProjectId === null) {
      await api.updateInboxDescription("");
      await queryClient.invalidateQueries({ queryKey: inboxDescriptionQueryKey });
    } else {
      updateProjectMutation.mutate({ id: targetProjectId, description: "" });
    }
  };
  const scopeDescriptionBlock = editingScopeDescription ? (
    <section className="scope-description-editor" aria-label="Description editor">
      <h2>Description</h2>
      <AutoGrowTextarea
        ariaLabel="Scope description"
        autoFocus
        value={scopeDescriptionDraft}
        onChange={setScopeDescriptionDraft}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setEditingScopeDescription(false);
          }
        }}
      />
      <div>
        <button type="button" className="btn-primary" onClick={() => void saveScopeDescription()}>
          Save
        </button>
        <button type="button" onClick={() => setEditingScopeDescription(false)}>
          Cancel
        </button>
      </div>
    </section>
  ) : currentScopeDescription ? (
    <section className="scope-description" aria-labelledby="scope-description-title">
      <div>
        <h2 id="scope-description-title">Description</h2>
        <div>
          <button type="button" aria-label="Edit description" onClick={startScopeDescriptionEdit}>
            <Edit3 size={14} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            aria-label="Delete description"
            className="danger"
            onClick={() => void removeScopeDescription()}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>
      <p>{currentScopeDescription}</p>
    </section>
  ) : (
    <button type="button" className="add-description-trigger" onClick={startScopeDescriptionEdit}>
      <Plus size={15} aria-hidden="true" />
      Add description
    </button>
  );

  const taskActions = Object.freeze({
    toggleTask: toggleMutation.mutate,
    startEditing,
    openDetails,
    selectionMode,
    attachmentsEnabled,
    selectedTaskIds,
    toggleTaskSelection,
    openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => {
      if (pageMode !== "tasks") return;
      event.preventDefault();
      const width = 196;
      const height = 176;
      setTaskContextMenu(
        Object.freeze({
          task,
          left: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
          top: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
        }),
      );
    },
    startSubtask,
    startDragging,
    startMobileTaskDrag,
    moveMobileDrag,
    finishMobileDrag,
    cancelMobileDrag,
    deleteTask: requestTaskDelete,
    submitSubtask,
    submitEdit,
    cancelSubtask: () => {
      setSubtaskParentId(null);
      setSubtaskTitle("");
    },
    cancelEdit: () => {
      setEditTaskId(null);
      setEditTitle("");
      setEditPlacement(inboxPlacement);
    },
    editTaskId,
    editTitle,
    editPlacement,
    subtaskParentId,
    subtaskTitle,
    draggingTaskId,
    activeDragTarget,
    placementOptions: createPlacementOptions(activeProjects, allSections),
    moveTaskOntoTask,
    markDragTarget,
    clearDragTarget: () => setActiveDragTarget(null),
    finishDragging: () => {
      setDraggingTaskId(null);
      setActiveDragTarget(null);
    },
    handleTaskKeys,
    setEditTitle,
    setEditPlacement,
    setSubtaskTitle,
  });

  const taskTargetLabel =
    targetSectionId !== null
      ? (allSections.find((section) => section.id === targetSectionId)?.title ?? "selected section")
      : targetProjectId !== null
        ? (allProjects.find((project) => project.id === targetProjectId)?.title ?? "selected project")
        : "Inbox";
  const pageMode =
    currentPath === "/dates"
      ? "dates"
      : currentPath === "/labels"
        ? "labels"
        : currentPath === "/attachments"
          ? "attachments"
          : currentPath === "/export"
            ? "export"
            : "tasks";
  useEffect(() => {
    if (pageMode !== "tasks") clearSelection();
  }, [pageMode]);
  useEffect(() => {
    const handleSelectionKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectionMode) {
          event.preventDefault();
          clearSelection();
        }
        return;
      }
      if (event.repeat) return;
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.code !== "KeyS" || typing || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (selectionMode) clearSelection();
      else setSelectionMode(true);
    };
    document.addEventListener("keydown", handleSelectionKeys);
    return () => document.removeEventListener("keydown", handleSelectionKeys);
  }, [selectionMode]);
  const selectedLabel = new URLSearchParams(window.location.search).get("label") ?? "";
  const todayDate = toLocalIsoDate(new Date());
  const viewTasks =
    pageMode === "dates"
      ? filterTaskTree(allTasks, (task) => {
          if (!task.dueDate) return false;
          switch (dateListFilter) {
            case "all":
              return true;
            case "overdue":
              return task.dueDate < todayDate;
            case "today":
              return task.dueDate === todayDate;
            case "upcoming":
              return task.dueDate > todayDate;
          }
        })
      : filterTaskTree(
          allTasks,
          (task) => task.labels.length > 0 && (!selectedLabel || task.labels.includes(selectedLabel)),
        );
  const calendarTasks = Object.freeze(flatTasks.filter((task) => task.dueDate !== null));
  const calendarDays = buildCalendarDays(calendarMonth);
  const calendarLabel = calendarMonthLabel(calendarMonth);
  const calendarTaskCount = calendarTasks.filter((task) => task.dueDate?.startsWith(calendarMonth)).length;
  const calendarTaskLocation = (task: Task) => {
    const taskSection =
      task.sectionId === null ? null : (allSections.find((item) => item.id === task.sectionId) ?? null);
    const taskProject =
      task.projectId === null ? null : (allProjects.find((item) => item.id === task.projectId) ?? null);
    return taskSection?.title ?? taskProject?.title ?? "Inbox";
  };
  const viewTitle =
    pageMode === "dates"
      ? "Dates"
      : pageMode === "labels"
        ? selectedLabel
          ? `Label: ${selectedLabel}`
          : "Labels"
        : pageMode === "attachments"
          ? "Attachments"
          : pageMode === "export"
            ? "Export"
            : targetProjectId === null
              ? "Inbox"
              : taskTargetLabel;
  const taskAttachments = Object.freeze(
    flatTasks.flatMap((task) =>
      task.comments.flatMap((comment) =>
        (comment.attachments ?? []).map((attachment) =>
          Object.freeze({
            ...attachment,
            taskId: task.id,
            taskTitle: task.title,
            uploadedAt: comment.createdAt,
          }),
        ),
      ),
    ),
  );
  const markdown = currentMarkdown(taskTargetLabel, inboxRootTasks, allSections, allTasks, targetProjectId);
  const openAddTaskDialog = (placement: string) => {
    setAddTaskPlacement(placement);
    setAddTaskTitle("");
    setAddTaskDescription("");
    setAddTaskFiles(Object.freeze([]));
    setAddTaskDate("");
    setAddTaskLabels(Object.freeze([]));
    setAddTaskLabelInput("");
    setShowAddTaskDescription(false);
    setShowAddTaskDate(false);
    setShowAddTaskLabels(false);
    setAddTaskOpen(true);
  };
  const deleteAllTasks = async () => {
    const roots = flatTasks.filter((task) => task.parentId === null && task.projectId === targetProjectId);
    if (roots.length === 0) return;
    const scope =
      targetProjectId === null
        ? "Inbox"
        : (allProjects.find((project) => project.id === targetProjectId)?.title ?? "this project");
    if (!confirmDeletion(`Delete all ${roots.length} top-level tasks in ${scope}, including their subtasks?`))
      return;
    await Promise.all(roots.map((task) => api.deleteTask(task.id)));
    await queryClient.invalidateQueries({ queryKey: taskQueryKey });
  };
  const deleteSelectedTasks = () => {
    if (
      selectedRootTasks.length === 0 ||
      !confirmDeletion(
        `Delete ${selectedRootTasks.length} selected ${selectedRootTasks.length === 1 ? "task" : "tasks"} and all their subtasks?`,
      )
    )
      return;
    selectedDeleteMutation.mutate(Object.freeze(selectedRootTasks.map((task) => task.id)));
  };
  const moveSelectedTasks = () => {
    if (selectedRootTasks.length === 0) return;
    const placement = parsePlacement(selectedMovePlacement, allSections);
    selectedMoveMutation.mutate(
      Object.freeze({ taskIds: Object.freeze(selectedRootTasks.map((task) => task.id)), ...placement }),
    );
  };
  const selectionToolbar = selectionMode ? (
    <div className="selection-toolbar" role="group" aria-label="Selected task actions">
      <span role="status">{selectedRootTasks.length} selected</span>
      <button
        type="button"
        className="danger"
        disabled={selectedRootTasks.length === 0 || selectedDeleteMutation.isPending}
        onClick={deleteSelectedTasks}
      >
        <Trash2 size={15} aria-hidden="true" />
        Delete selected tasks
      </button>
      <button
        type="button"
        disabled={selectedRootTasks.length === 0 || selectedMoveMutation.isPending}
        onClick={() => {
          setSelectedMovePlacement(
            targetProjectId === null ? inboxPlacement : projectPlacement(targetProjectId),
          );
          setSelectedMoveOpen(true);
        }}
      >
        <MoveRight size={15} aria-hidden="true" />
        Move selected tasks
      </button>
      <button type="button" onClick={clearSelection}>
        Cancel selection
      </button>
    </div>
  ) : null;

  const finishDndDrag = (_event: DragEndEvent) => {
    setDraggingTaskId(null);
    setActiveDragTarget(null);
    setActiveDropZone(null);
  };

  const allMarkdown = allMarkdownDocument(allProjects, allSections, allTasks);
  const allJson = JSON.stringify(
    Object.freeze({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      inbox: Object.freeze({
        description: inboxDescriptionQuery.data ?? "",
        sections: allSections.filter((section) => section.projectId === null),
        tasks: flatTasks.filter((task) => task.projectId === null),
      }),
      projects: allProjects.map((project) =>
        Object.freeze({
          ...project,
          sections: allSections.filter((section) => section.projectId === project.id),
          tasks: flatTasks.filter((task) => task.projectId === project.id),
        }),
      ),
      sections: allSections,
      tasks: flatTasks,
      taskTree: allTasks,
      dates: flatTasks
        .filter((task) => task.dueDate !== null)
        .map((task) => Object.freeze({ taskId: task.id, dueDate: task.dueDate })),
      comments: flatTasks.flatMap((task) =>
        task.comments.map((comment) => Object.freeze({ ...comment, taskId: task.id })),
      ),
      descriptions: Object.freeze({
        inbox: inboxDescriptionQuery.data ?? "",
        projects: allProjects.map((project) =>
          Object.freeze({ id: project.id, description: project.description }),
        ),
        tasks: flatTasks
          .filter((task) => task.description.length > 0)
          .map((task) => Object.freeze({ id: task.id, description: task.description })),
      }),
    }),
    null,
    2,
  );
  const scopeProject =
    targetProjectId === null ? null : (allProjects.find((project) => project.id === targetProjectId) ?? null);
  const scopeSections = allSections.filter((section) => section.projectId === targetProjectId);
  const scopeTasks = flatTasks.filter((task) => task.projectId === targetProjectId);
  const scopeTaskTree = filterTaskTree(allTasks, (task) => task.projectId === targetProjectId);
  const scopeDescription =
    targetProjectId === null ? (inboxDescriptionQuery.data ?? "") : (scopeProject?.description ?? "");
  const advancedMarkdown = currentAdvancedMarkdown(
    taskTargetLabel,
    allSections,
    allTasks,
    targetProjectId,
    scopeDescription,
  );
  const allAdvancedMarkdown = allAdvancedMarkdownDocument(
    allProjects,
    allSections,
    allTasks,
    inboxDescriptionQuery.data ?? "",
  );
  const scopeJson = JSON.stringify(
    Object.freeze({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      scope: Object.freeze({
        type: targetProjectId === null ? "inbox" : "project",
        id: targetProjectId,
        title: targetProjectId === null ? "Inbox" : (scopeProject?.title ?? taskTargetLabel),
      }),
      inbox:
        targetProjectId === null
          ? Object.freeze({ description: scopeDescription, sections: scopeSections, tasks: scopeTasks })
          : null,
      project:
        scopeProject === null
          ? null
          : Object.freeze({ ...scopeProject, sections: scopeSections, tasks: scopeTasks }),
      sections: scopeSections,
      tasks: scopeTasks,
      taskTree: scopeTaskTree,
      dates: scopeTasks
        .filter((task) => task.dueDate !== null)
        .map((task) => Object.freeze({ taskId: task.id, dueDate: task.dueDate })),
      comments: scopeTasks.flatMap((task) =>
        task.comments.map((comment) => Object.freeze({ ...comment, taskId: task.id })),
      ),
      descriptions: Object.freeze({
        scope: scopeDescription,
        tasks: scopeTasks
          .filter((task) => task.description.length > 0)
          .map((task) => Object.freeze({ id: task.id, description: task.description })),
      }),
    }),
    null,
    2,
  );

  const exportMarkdown = () => {
    downloadBlob(new Blob([allMarkdown], { type: "text/markdown;charset=utf-8" }), "mytodo.md");
  };
  const exportAdvancedMarkdown = () => {
    downloadBlob(
      new Blob([allAdvancedMarkdown], { type: "text/markdown;charset=utf-8" }),
      "mytodo-advanced.md",
    );
  };

  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={finishDndDrag}>
      {createPortal(
        <ToastContainer
          position="bottom-right"
          autoClose={5000}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />,
        document.body,
      )}
      <main className="shell app-layout">
        <AppSidebar
          api={api}
          selectedProjectId={targetProjectId}
          onInboxSelect={() => {
            clearSelection();
            setTargetProjectId(null);
            setTargetSectionId(null);
          }}
          onProjectSelect={(id) => {
            clearSelection();
            setTargetProjectId(id);
            setTargetSectionId(null);
          }}
          onTaskSelect={(task) => {
            const node = findTaskNode(allTasks, task.id);
            if (node !== null) openDetails(node);
          }}
          onAddTask={() =>
            openAddTaskDialog(
              pageMode === "tasks"
                ? targetSectionId === null
                  ? targetProjectId === null
                    ? inboxPlacement
                    : projectPlacement(targetProjectId)
                  : sectionPlacement(targetSectionId)
                : inboxPlacement,
            )
          }
          isProjectDropActive={(id) =>
            activeDropZone === (id === null ? inboxPlacement : projectPlacement(id))
          }
          onInboxDragEnter={markDropZone(null, null)}
          onInboxDragOver={markDropZone(null, null)}
          onInboxDragLeave={() => setActiveDropZone(null)}
          onInboxDrop={moveDroppedTask(null, null)}
          onProjectDragEnter={(id) => markDropZone(id, null)}
          onProjectDragOver={(id) => markDropZone(id, null)}
          onProjectDragLeave={() => () => setActiveDropZone(null)}
          onProjectDrop={(id) => moveDroppedTask(id, null)}
        />
        <button
          type="button"
          className="mobile-quick-add"
          aria-label="Quick add task"
          onClick={() =>
            openAddTaskDialog(
              pageMode === "tasks"
                ? targetSectionId === null
                  ? targetProjectId === null
                    ? inboxPlacement
                    : projectPlacement(targetProjectId)
                  : sectionPlacement(targetSectionId)
                : inboxPlacement,
            )
          }
        >
          <Plus size={25} aria-hidden="true" />
        </button>

        <section className="workspace card shadow-sm" aria-label="Task manager">
          <header className="header">
            <p className="eyebrow">Self-hosted MVP</p>
            <h1>{viewTitle}</h1>
            {pageMode === "tasks" ? (
              <div className="task-header-actions">
                {!selectionMode ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary select-tasks-button"
                    onClick={() => setSelectionMode(true)}
                  >
                    <ListChecks size={16} aria-hidden="true" />
                    Select tasks
                  </button>
                ) : null}
                <button
                  type="button"
                  className="scope-export-trigger btn-primary"
                  onClick={() => setScopeExportOpen(true)}
                >
                  <Download size={16} aria-hidden="true" />
                  Export
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger delete-all-tasks-button"
                  disabled={
                    !flatTasks.some((task) => task.parentId === null && task.projectId === targetProjectId)
                  }
                  onClick={() => void deleteAllTasks()}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Delete all tasks
                </button>
              </div>
            ) : null}
          </header>

          {pageMode === "tasks" ? selectionToolbar : null}

          {tasks.isLoading ? <p className="muted">Loading tasks...</p> : null}
          {tasks.isError ? <p className="error">Unable to load tasks.</p> : null}
          {pageMode === "dates" || pageMode === "labels" ? (
            <section className="drop-zone task-filter-page" aria-label={`${viewTitle} tasks`}>
              {pageMode === "dates" ? (
                <div className="date-view-switch" aria-label="Date view">
                  <button
                    type="button"
                    aria-pressed={dateView === "list"}
                    onClick={() => setDateView("list")}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    aria-pressed={dateView === "calendar"}
                    onClick={() => setDateView("calendar")}
                  >
                    Calendar
                  </button>
                </div>
              ) : null}
              {pageMode === "dates" && dateView === "list" ? (
                <nav className="date-list-filter" aria-label="Filter dated tasks">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "overdue", label: "Overdue" },
                      { id: "today", label: "Today" },
                      { id: "upcoming", label: "Upcoming" },
                    ] as const
                  ).map((filter) => (
                    <button
                      type="button"
                      key={filter.id}
                      aria-pressed={dateListFilter === filter.id}
                      onClick={() => setDateListFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </nav>
              ) : null}
              {pageMode === "labels" ? (
                <nav className="label-filter-list" aria-label="Filter by label">
                  <Link className={!selectedLabel ? "active" : ""} to="/labels">
                    All labels
                  </Link>
                  {Array.from(new Set(flatTasks.flatMap((task) => task.labels)))
                    .sort()
                    .map((label) => (
                      <Link
                        key={label}
                        className={selectedLabel === label ? "active" : ""}
                        to={`/labels?label=${encodeURIComponent(label)}`}
                      >
                        {label}
                      </Link>
                    ))}
                </nav>
              ) : null}
              {pageMode === "dates" && dateView === "calendar" ? (
                <section className="calendar-panel" aria-labelledby="calendar-month-heading">
                  <header className="calendar-month-control">
                    <div className="calendar-month-navigation">
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => setCalendarMonth((month) => shiftCalendarMonth(month, -1))}
                      >
                        <ChevronLeft size={18} aria-hidden="true" />
                      </button>
                      <h2 id="calendar-month-heading">{calendarLabel}</h2>
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => setCalendarMonth((month) => shiftCalendarMonth(month, 1))}
                      >
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="calendar-month-summary">
                      {calendarTaskCount} {calendarTaskCount === 1 ? "task" : "tasks"}
                    </p>
                    <div className="calendar-month-actions">
                      <button
                        type="button"
                        className="calendar-today-button"
                        onClick={() => setCalendarMonth(toLocalIsoDate(new Date()).slice(0, 7))}
                      >
                        Today
                      </button>
                      <label className="calendar-month-picker">
                        <span>Choose month</span>
                        <input
                          aria-label="Calendar month"
                          type="month"
                          value={calendarMonth}
                          onChange={(event) => {
                            if (event.target.value) setCalendarMonth(event.target.value);
                          }}
                        />
                      </label>
                    </div>
                  </header>
                  <div className="dates-calendar-scroll">
                    <div className="dates-calendar-frame">
                      <div className="dates-calendar-weekdays" role="row">
                        {calendarWeekdays.map((weekday, index) => (
                          <div
                            key={weekday}
                            role="columnheader"
                            className={index > 4 ? "weekend" : undefined}
                          >
                            {weekday}
                          </div>
                        ))}
                      </div>
                      <div className="dates-calendar" role="grid" aria-label="Calendar view">
                        {calendarDays.map((day) => {
                          const matching = calendarTasks.filter((task) => task.dueDate === day.date);
                          return (
                            <section
                              key={day.date}
                              role="gridcell"
                              className={clsx(
                                "dates-calendar-day",
                                !day.isCurrentMonth && "outside-month",
                                day.isWeekend && "weekend",
                                day.isToday && "today",
                                activeCalendarDate === day.date && "calendar-drop-active",
                              )}
                              aria-label={`Tasks for ${day.date}`}
                              onDragOver={markCalendarDate(day.date)}
                              onDragLeave={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                                  setActiveCalendarDate(null);
                              }}
                              onDrop={dropTaskOnCalendarDate(day.date)}
                            >
                              <header className="calendar-day-header">
                                <time dateTime={day.date} aria-current={day.isToday ? "date" : undefined}>
                                  {day.day}
                                </time>
                                {matching.length > 0 ? (
                                  <span
                                    aria-label={`${matching.length} ${matching.length === 1 ? "task" : "tasks"}`}
                                  >
                                    {matching.length}
                                  </span>
                                ) : null}
                              </header>
                              <div className="calendar-day-tasks">
                                {matching.map((task) => (
                                  <button
                                    type="button"
                                    className="calendar-task-card"
                                    aria-label={task.title}
                                    title={`${task.title} · ${calendarTaskLocation(task)}`}
                                    key={task.id}
                                    draggable
                                    onDragStart={(event) => {
                                      calendarDraggedTaskRef.current = task.id;
                                      setDraggingTaskId(task.id);
                                      event.dataTransfer.setData("text/task-id", task.id);
                                      event.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEnd={() => {
                                      calendarDraggedTaskRef.current = null;
                                      setDraggingTaskId(null);
                                      setActiveCalendarDate(null);
                                    }}
                                    onClick={() => {
                                      const node = findTaskNode(allTasks, task.id);
                                      if (node) openDetails(node);
                                    }}
                                  >
                                    <span>{task.title}</span>
                                    <small>{calendarTaskLocation(task)}</small>
                                  </button>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              ) : viewTasks.length > 0 ? (
                renderTaskNodes(viewTasks, taskActions)
              ) : (
                <p className="empty">
                  {pageMode === "dates"
                    ? dateListFilter === "all"
                      ? "No dated tasks yet."
                      : dateListFilter === "today"
                        ? "No tasks due today."
                        : `No ${dateListFilter} tasks.`
                    : "No tasks with this label."}
                </p>
              )}
            </section>
          ) : pageMode === "attachments" && attachmentsEnabled ? (
            <section className="attachments-page" aria-label="Attachments list">
              {taskAttachments.length > 0 ? (
                taskAttachments.map((attachment) => (
                  <article className="attachment-library-item" key={attachment.id}>
                    <div className="attachment-library-preview">
                      {attachment.mimeType.startsWith("image/") ? (
                        <a
                          href={`/attachments/${encodeURIComponent(attachment.id)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={`/attachments/${encodeURIComponent(attachment.id)}`}
                            alt={attachment.name}
                          />
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
                        onClick={() => {
                          const task = findTaskNode(allTasks, attachment.taskId);
                          if (task !== null) openDetails(task);
                        }}
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
              ) : tasks.isLoading ? (
                <p className="muted">Loading attachments...</p>
              ) : (
                <p className="empty">No attachments yet.</p>
              )}
            </section>
          ) : pageMode === "export" ? (
            <section className="export-page" aria-label="Export data">
              <section className="card export-format-card" aria-labelledby="markdown-export-title">
                <div>
                  <h2 id="markdown-export-title">Markdown</h2>
                  <p>Human-readable task lists organized by Inbox, projects, and sections.</p>
                </div>
                <div className="export-format-actions">
                  <button type="button" className="btn-primary" onClick={exportMarkdown}>
                    <Download size={16} aria-hidden="true" />
                    Export all markdown
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyText(allMarkdown);
                      setCopyStatus("All markdown copied");
                    }}
                  >
                    <ClipboardCopy size={16} aria-hidden="true" />
                    Copy all markdown
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMarkdownModal(
                        Object.freeze({ title: "All tasks", markdown: allMarkdown, format: "markdown" }),
                      )
                    }
                  >
                    <Eye size={16} aria-hidden="true" />
                    Preview all markdown
                  </button>
                </div>
              </section>
              <section className="card export-format-card" aria-labelledby="advanced-markdown-export-title">
                <div>
                  <h2 id="advanced-markdown-export-title">Advanced markdown</h2>
                  <p>
                    Includes task descriptions, due dates, labels, comments, and Inbox and project
                    descriptions.
                  </p>
                </div>
                <div className="export-format-actions">
                  <button type="button" className="btn-primary" onClick={exportAdvancedMarkdown}>
                    <Download size={16} aria-hidden="true" />
                    Export all advanced markdown
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyText(allAdvancedMarkdown);
                      setCopyStatus("All advanced markdown copied");
                    }}
                  >
                    <ClipboardCopy size={16} aria-hidden="true" />
                    Copy all advanced markdown
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMarkdownModal(
                        Object.freeze({
                          title: "All tasks",
                          markdown: allAdvancedMarkdown,
                          format: "advanced-markdown",
                        }),
                      )
                    }
                  >
                    <Eye size={16} aria-hidden="true" />
                    Preview all advanced markdown
                  </button>
                </div>
              </section>
              <section className="card export-format-card" aria-labelledby="json-export-title">
                <div>
                  <h2 id="json-export-title">JSON</h2>
                  <p>
                    Complete structured data, including descriptions, dates, sections, task hierarchy, labels,
                    comments, and archived projects.
                  </p>
                </div>
                <div className="export-format-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      downloadBlob(
                        new Blob([allJson], { type: "application/json;charset=utf-8" }),
                        "mytodo.json",
                      )
                    }
                  >
                    <Download size={16} aria-hidden="true" />
                    Export all JSON
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyText(allJson);
                      setCopyStatus("All JSON copied");
                    }}
                  >
                    <ClipboardCopy size={16} aria-hidden="true" />
                    Copy all JSON
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMarkdownModal(
                        Object.freeze({ title: "All data", markdown: allJson, format: "json" }),
                      )
                    }
                  >
                    <Eye size={16} aria-hidden="true" />
                    Preview all JSON
                  </button>
                </div>
              </section>
              {copyStatus.length > 0 ? (
                <p className="muted" role="status">
                  {copyStatus}
                </p>
              ) : null}
            </section>
          ) : targetProjectId === null ? (
            <div className="board">
              {scopeDescriptionBlock}
              <section
                className={clsx("drop-zone", activeDropZone === "inbox" && "drop-active")}
                onDragEnter={markDropZone(null, null)}
                onDragOver={markDropZone(null, null)}
                onDragLeave={() => setActiveDropZone(null)}
                onDrop={moveDroppedTask(null, null)}
                aria-label="Inbox tasks"
              >
                <div className="task-scope-heading">
                  <h2>Inbox</h2>
                  <button
                    type="button"
                    className="scope-add-task-button"
                    aria-label="Add task to Inbox"
                    onClick={() => openAddTaskDialog(inboxPlacement)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add task
                  </button>
                </div>
                {inboxRootTasks.length > 0 ? (
                  renderTaskNodes(inboxRootTasks, taskActions)
                ) : (
                  <p className="empty">No inbox tasks yet.</p>
                )}
              </section>
              <div className="section-create-block">
                {addingSection ? (
                  <form
                    className="inline-create-form"
                    onSubmit={submitSection}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelSectionCreate();
                      }
                    }}
                  >
                    <label htmlFor="section-title">Title</label>
                    <input
                      ref={sectionCreateInputRef}
                      id="section-title"
                      aria-label="Section title"
                      value={sectionTitle}
                      onChange={(event) => setSectionTitle(event.target.value)}
                    />
                    <div>
                      <button type="submit" className="btn-primary">
                        Save
                      </button>
                      <button type="button" onClick={cancelSectionCreate}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="add-section-trigger"
                    onClick={() => {
                      setSectionTitle("");
                      setAddingSection(true);
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add section
                  </button>
                )}
              </div>
              {inboxSections.map((section) => {
                const sectionTasks = allTasks.filter(
                  (task) => task.projectId === null && task.sectionId === section.id,
                );

                return (
                  <section
                    key={section.id}
                    data-mobile-drop-section={section.id}
                    className={clsx(
                      "drop-zone",
                      activeDropZone === sectionPlacement(section.id) && "drop-active",
                    )}
                    onDragEnter={markDropZone(null, section.id)}
                    onDragOver={markDropZone(null, section.id)}
                    onDragLeave={() => setActiveDropZone(null)}
                    onDrop={moveDroppedTask(null, section.id)}
                    aria-label={`Section ${section.title}`}
                  >
                    <div
                      className={clsx(
                        "section-header",
                        draggingSectionId === section.id && "section-dragging",
                        activeSectionDrop?.id === section.id && `section-drop-${activeSectionDrop.position}`,
                      )}
                      draggable={editSectionId !== section.id}
                      onDragStart={startSectionDrag(section)}
                      onDragEnd={() => {
                        setDraggingSectionId(null);
                        setActiveSectionDrop(null);
                      }}
                      onDragEnter={markSectionDrop(section)}
                      onDragOver={markSectionDrop(section)}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                          setActiveSectionDrop(null);
                      }}
                      onDrop={dropSection(section, inboxSections)}
                    >
                      {editSectionId === section.id ? (
                        <form
                          className="section-edit-form"
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditSectionId(null);
                              setEditSectionTitle("");
                            }
                          }}
                          onSubmit={submitSectionEdit(section)}
                        >
                          <label htmlFor={`section-edit-${section.id}`}>Section title</label>
                          <input
                            id={`section-edit-${section.id}`}
                            autoFocus
                            value={editSectionTitle}
                            onChange={(event) => setEditSectionTitle(event.target.value)}
                          />
                          <button type="submit">Save section</button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditSectionId(null);
                              setEditSectionTitle("");
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <h2>{section.title}</h2>
                          <div className="section-actions">
                            <button
                              type="button"
                              aria-label={`Add task to section ${section.title}`}
                              onClick={() => openAddTaskDialog(sectionPlacement(section.id))}
                            >
                              <Plus size={14} aria-hidden="true" />
                              Add task
                            </button>
                            <button
                              type="button"
                              aria-label={`Edit section ${section.title}`}
                              onClick={() => startSectionEdit(section)}
                            >
                              <Edit3 size={14} aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger"
                              aria-label={`Delete section ${section.title}`}
                              onClick={() => requestSectionDelete(section)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {sectionTasks.length > 0 ? (
                      renderTaskNodes(sectionTasks, taskActions)
                    ) : (
                      <p className="empty">Drop inbox tasks here.</p>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="board">
              {scopeDescriptionBlock}
              <section
                className={clsx(
                  "drop-zone",
                  activeDropZone === projectPlacement(targetProjectId) && "drop-active",
                )}
                onDragEnter={markDropZone(targetProjectId, null)}
                onDragOver={markDropZone(targetProjectId, null)}
                onDragLeave={() => setActiveDropZone(null)}
                onDrop={moveDroppedTask(targetProjectId, null)}
                aria-label={`${taskTargetLabel} tasks`}
              >
                <div className="task-scope-heading project-task-scope-heading">
                  <button
                    type="button"
                    className="scope-add-task-button"
                    aria-label={`Add task to ${taskTargetLabel}`}
                    onClick={() => openAddTaskDialog(projectPlacement(targetProjectId))}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add task
                  </button>
                </div>
                {allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null)
                  .length > 0 ? (
                  renderTaskNodes(
                    allTasks.filter((task) => task.projectId === targetProjectId && task.sectionId === null),
                    taskActions,
                  )
                ) : (
                  <p className="empty">No project tasks yet.</p>
                )}
              </section>
              <div className="section-create-block">
                {addingSection ? (
                  <form
                    className="inline-create-form"
                    onSubmit={submitSection}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelSectionCreate();
                      }
                    }}
                  >
                    <label htmlFor="section-title">Title</label>
                    <input
                      ref={sectionCreateInputRef}
                      id="section-title"
                      aria-label="Section title"
                      value={sectionTitle}
                      onChange={(event) => setSectionTitle(event.target.value)}
                    />
                    <div>
                      <button type="submit" className="btn-primary">
                        Save
                      </button>
                      <button type="button" onClick={cancelSectionCreate}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="add-section-trigger"
                    onClick={() => {
                      setSectionTitle("");
                      setAddingSection(true);
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add section
                  </button>
                )}
              </div>
              {projectSections.map((section) => {
                const sectionTasks = allTasks.filter(
                  (task) => task.projectId === targetProjectId && task.sectionId === section.id,
                );
                return (
                  <section
                    key={section.id}
                    className={clsx(
                      "drop-zone",
                      activeDropZone === sectionPlacement(section.id) && "drop-active",
                    )}
                    onDragEnter={markDropZone(targetProjectId, section.id)}
                    onDragOver={markDropZone(targetProjectId, section.id)}
                    onDragLeave={() => setActiveDropZone(null)}
                    onDrop={moveDroppedTask(targetProjectId, section.id)}
                    aria-label={`Section ${section.title}`}
                  >
                    <div
                      className={clsx(
                        "section-header",
                        draggingSectionId === section.id && "section-dragging",
                        activeSectionDrop?.id === section.id && `section-drop-${activeSectionDrop.position}`,
                      )}
                      draggable={editSectionId !== section.id}
                      onDragStart={startSectionDrag(section)}
                      onDragEnd={() => {
                        setDraggingSectionId(null);
                        setActiveSectionDrop(null);
                      }}
                      onDragEnter={markSectionDrop(section)}
                      onDragOver={markSectionDrop(section)}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                          setActiveSectionDrop(null);
                      }}
                      onDrop={dropSection(section, projectSections)}
                    >
                      {editSectionId === section.id ? (
                        <form
                          className="section-edit-form"
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditSectionId(null);
                              setEditSectionTitle("");
                            }
                          }}
                          onSubmit={submitSectionEdit(section)}
                        >
                          <label htmlFor={`section-edit-${section.id}`}>Section title</label>
                          <input
                            id={`section-edit-${section.id}`}
                            autoFocus
                            value={editSectionTitle}
                            onChange={(event) => setEditSectionTitle(event.target.value)}
                          />
                          <button type="submit">Save section</button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditSectionId(null);
                              setEditSectionTitle("");
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <h2>{section.title}</h2>
                          <div className="section-actions">
                            <button
                              type="button"
                              aria-label={`Add task to section ${section.title}`}
                              onClick={() => openAddTaskDialog(sectionPlacement(section.id))}
                            >
                              <Plus size={14} aria-hidden="true" />
                              Add task
                            </button>
                            <button
                              type="button"
                              aria-label={`Edit section ${section.title}`}
                              onClick={() => startSectionEdit(section)}
                            >
                              <Edit3 size={14} aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger"
                              aria-label={`Delete section ${section.title}`}
                              onClick={() => requestSectionDelete(section)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {sectionTasks.length > 0 ? (
                      renderTaskNodes(sectionTasks, taskActions)
                    ) : (
                      <p className="empty">Drop project tasks here.</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {pageMode === "tasks" ? selectionToolbar : null}
        </section>
        {selectedMoveOpen ? (
          <div
            className="selection-move-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedMoveOpen(false);
            }}
          >
            <section
              className="selection-move-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Move selected tasks"
              onKeyDown={(event) => {
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
                  disabled={selectedMoveMutation.isPending}
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
                <button
                  type="button"
                  aria-label="Close export options"
                  onClick={() => setScopeExportOpen(false)}
                >
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
                        setMarkdownModal(
                          Object.freeze({
                            title: targetProjectId === null ? "Inbox" : taskTargetLabel,
                            markdown,
                            format: "markdown",
                          }),
                        )
                      }
                    >
                      <Eye size={16} aria-hidden="true" />
                      Preview markdown
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
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
                        setMarkdownModal(
                          Object.freeze({
                            title: targetProjectId === null ? "Inbox" : taskTargetLabel,
                            markdown: advancedMarkdown,
                            format: "advanced-markdown",
                          }),
                        )
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
                      Complete structured data with tasks, sections, dates, descriptions, labels, and
                      comments.
                    </p>
                  </div>
                  <div className="export-format-actions">
                    <button
                      type="button"
                      onClick={() =>
                        setMarkdownModal(
                          Object.freeze({
                            title: targetProjectId === null ? "Inbox" : taskTargetLabel,
                            markdown: scopeJson,
                            format: "json",
                          }),
                        )
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
        <AddTaskDialog
          draft={{
            open: addTaskOpen,
            setOpen: setAddTaskOpen,
            title: addTaskTitle,
            setTitle: setAddTaskTitle,
            description: addTaskDescription,
            setDescription: setAddTaskDescription,
            files: addTaskFiles,
            setFiles: setAddTaskFiles,
            date: addTaskDate,
            setDate: setAddTaskDate,
            datePickerOpen: addTaskDatePickerOpen,
            setDatePickerOpen: setAddTaskDatePickerOpen,
            dateBeforePicker: addTaskDateBeforePicker,
            setDateBeforePicker: setAddTaskDateBeforePicker,
            labels: addTaskLabels,
            setLabels: setAddTaskLabels,
            labelInput: addTaskLabelInput,
            setLabelInput: setAddTaskLabelInput,
            showDescription: showAddTaskDescription,
            setShowDescription: setShowAddTaskDescription,
            showDate: showAddTaskDate,
            setShowDate: setShowAddTaskDate,
            showLabels: showAddTaskLabels,
            setShowLabels: setShowAddTaskLabels,
            placement: addTaskPlacement,
            setPlacement: setAddTaskPlacement,
          }}
          attachmentsEnabled={attachmentsEnabled}
          availableLabels={availableLabels}
          placementOptions={createPlacementOptions(
            activeProjects,
            allSections.filter(
              (section) =>
                section.projectId === null ||
                activeProjects.some((project) => project.id === section.projectId),
            ),
          )}
          pastedFiles={pastedFiles}
          notifyAttachedFiles={notifyAttachedFiles}
          onSubmit={async (event) => {
            event.preventDefault();
            const taskTitle = addTaskTitle.trim();
            if (!taskTitle) return;
            const placement = parsePlacement(addTaskPlacement, allSections);
            const created = await api.createTask(taskTitle, placement.projectId, placement.sectionId, null);
            if (addTaskFiles.length) {
              try {
                await api.createComment(created.id, "", addTaskFiles);
              } catch (error) {
                await api.deleteTask(created.id);
                throw error;
              }
            }
            const labels = normalizeLabels([...addTaskLabels, addTaskLabelInput]);
            const patch: Parameters<ApplicationApi["updateTask"]>[1] = {
              description: addTaskDescription,
              dueDate: addTaskDate || null,
              labels,
            };
            if (patch.description || patch.dueDate || patch.labels?.length)
              await api.updateTask(created.id, patch);
            await queryClient.invalidateQueries({ queryKey: taskQueryKey });
            setAddTaskOpen(false);
          }}
        />
        {selectedDetailsTask !== null ? (
          <div
            className="task-details-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDetailsTaskId(null);
            }}
          >
            <section
              className="task-details-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Task details: ${selectedDetailsTask.title}`}
              onPasteCapture={(event) => {
                if (!attachmentsEnabled) return;
                const files = pastedFiles(event.clipboardData);
                if (files.length > 0) {
                  event.preventDefault();
                  const acceptedFiles = files.slice(0, Math.max(0, 10 - detailCommentFiles.length));
                  setDetailCommentFiles(Object.freeze([...detailCommentFiles, ...acceptedFiles]));
                  notifyAttachedFiles(acceptedFiles);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && editingDetailField === null && !datePickerOpen)
                  setDetailsTaskId(null);
              }}
            >
              <header className="task-details-header">
                <div className="task-details-header-path">
                  <a
                    href={
                      selectedDetailsProject === null
                        ? "/"
                        : `/?project=${encodeURIComponent(selectedDetailsProject.id)}`
                    }
                  >
                    {selectedDetailsProject?.title ?? "Inbox"}
                  </a>
                  {selectedDetailsSection !== null ? (
                    <>
                      <span aria-hidden="true">/</span>
                      <span>{selectedDetailsSection.title}</span>
                    </>
                  ) : null}
                  {selectedDetailsParent !== null ? (
                    <>
                      <span aria-hidden="true">/</span>
                      <a href={`/?task=${encodeURIComponent(selectedDetailsParent.id)}`}>
                        {selectedDetailsParent.title}
                      </a>
                    </>
                  ) : null}
                  <span aria-hidden="true">/</span>
                  <strong>{selectedDetailsTask.title}</strong>
                </div>
                <div>
                  <button
                    type="button"
                    aria-label="Close task details"
                    onClick={() => setDetailsTaskId(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>
              <div className="task-details-layout">
                <div className="task-details-main">
                  <div className="task-detail-editable">
                    {editingDetailField === "title" ? (
                      <div className="task-detail-editor">
                        <AutoGrowTextarea
                          autoFocus
                          ariaLabel="Edit task title"
                          value={detailTitle}
                          onChange={setDetailTitle}
                          onKeyDown={async (event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              event.stopPropagation();
                              setDetailTitle(selectedDetailsTask.title);
                              setEditingDetailField(null);
                            }
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              const value = detailTitle.trim();
                              if (value && (await saveTaskDetails({ title: value })))
                                setEditingDetailField(null);
                            }
                          }}
                        />
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailTitle(selectedDetailsTask.title);
                              setEditingDetailField(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={async () => {
                              const value = detailTitle.trim();
                              if (value && (await saveTaskDetails({ title: value })))
                                setEditingDetailField(null);
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="task-detail-title-display"
                        aria-label="Edit task title"
                        onClick={() => {
                          setDetailTitle(selectedDetailsTask.title);
                          setEditingDetailField("title");
                        }}
                      >
                        <span>{selectedDetailsTask.title}</span>
                        <Edit3 size={17} aria-hidden="true" />
                      </button>
                    )}
                    {editingDetailField === "description" ? (
                      <div className="task-detail-editor">
                        <AutoGrowTextarea
                          autoFocus
                          ariaLabel="Edit task description"
                          value={detailDescription}
                          onChange={setDetailDescription}
                          onKeyDown={async (event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              event.stopPropagation();
                              setDetailDescription(selectedDetailsTask.description);
                              setEditingDetailField(null);
                            }
                            if (event.key === "Enter" && event.ctrlKey) {
                              event.preventDefault();
                              if (await saveTaskDetails({ description: detailDescription }))
                                setEditingDetailField(null);
                            }
                          }}
                        />
                        <small className="editor-hint">Press Ctrl+Enter to save.</small>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailDescription(selectedDetailsTask.description);
                              setEditingDetailField(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={async () => {
                              if (await saveTaskDetails({ description: detailDescription }))
                                setEditingDetailField(null);
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="task-detail-description-display"
                        aria-label="Edit task description"
                        onClick={() => {
                          setDetailDescription(selectedDetailsTask.description);
                          setEditingDetailField("description");
                        }}
                      >
                        {selectedDetailsTask.description || "Add description"}
                      </button>
                    )}
                  </div>
                  <section
                    ref={subtasksSectionRef}
                    id="task-subtasks-section"
                    className={`card border task-subtasks-card${selectedDetailsTask.children.length === 0 && !showMobileSubtasks ? " task-subtasks-hidden" : " task-subtasks-open"}`}
                    aria-labelledby="task-subtasks-title"
                  >
                    <div className="card-header bg-light">
                      <strong id="task-subtasks-title">Subtasks</strong>
                      <span className="text-muted">
                        {selectedDetailsTask.children.filter((child) => child.completed).length}/
                        {selectedDetailsTask.children.length}
                      </span>
                      <button
                        type="button"
                        className="task-details-mobile-collapse"
                        aria-label="Delete all subtasks and hide section"
                        onClick={() => void closeMobileSubtasks()}
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="card-body task-subtasks-body">
                      {selectedDetailsTask.children.map((child) => (
                        <div className="details-subtask-row" key={child.id}>
                          <button
                            type="button"
                            className="details-subtask"
                            onClick={() => openDetails(child)}
                          >
                            {child.title}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete subtask ${child.title}`}
                            onClick={async () => {
                              if (!confirmDeletion(`Delete subtask “${child.title}” and its descendants?`))
                                return;
                              await api.deleteTask(child.id);
                              await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      <div className="details-subtask-add">
                        <AutoGrowTextarea
                          autoFocus={showMobileSubtasks && selectedDetailsTask.children.length === 0}
                          ariaLabel="New subtask title"
                          value={detailSubtask}
                          onChange={setDetailSubtask}
                          onKeyDown={async (event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              const title = detailSubtask.trim();
                              if (!title) return;
                              await api.createTask(
                                title,
                                selectedDetailsTask.projectId,
                                selectedDetailsTask.sectionId,
                                selectedDetailsTask.id,
                              );
                              setDetailSubtask("");
                              await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                            }
                          }}
                          placeholder="Add subtask"
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={async () => {
                            const title = detailSubtask.trim();
                            if (!title) return;
                            await api.createTask(
                              title,
                              selectedDetailsTask.projectId,
                              selectedDetailsTask.sectionId,
                              selectedDetailsTask.id,
                            );
                            setDetailSubtask("");
                            await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </section>
                  <TaskCommentsPanel
                    task={selectedDetailsTask}
                    api={api}
                    attachmentsEnabled={attachmentsEnabled}
                    showMobileComments={showMobileComments}
                    onHide={closeMobileComments}
                    editingCommentId={editingCommentId}
                    setEditingCommentId={setEditingCommentId}
                    editingCommentBody={editingCommentBody}
                    setEditingCommentBody={setEditingCommentBody}
                    detailComment={detailComment}
                    setDetailComment={setDetailComment}
                    detailCommentFiles={detailCommentFiles}
                    setDetailCommentFiles={setDetailCommentFiles}
                    removeCommentAttachment={removeCommentAttachment}
                    confirmDeletion={confirmDeletion}
                    notifyAttachedFiles={notifyAttachedFiles}
                  />
                </div>
                <aside className="task-details-sidebar">
                  <div className="task-details-mobile-shortcuts">
                    {!selectedDetailsTask.labels.length && !showMobileLabels ? (
                      <button type="button" onClick={() => setShowMobileLabels(true)}>
                        <Plus size={15} aria-hidden="true" />
                        Labels
                      </button>
                    ) : null}
                    {!detailDueDate && !showMobileDate ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileDate(true);
                          setDatePickerOpen(true);
                        }}
                      >
                        <Plus size={15} aria-hidden="true" />
                        Date
                      </button>
                    ) : null}
                    {selectedDetailsTask.children.length === 0 && !showMobileSubtasks ? (
                      <button
                        type="button"
                        aria-expanded="false"
                        aria-controls="task-subtasks-section"
                        onClick={() => setShowMobileSubtasks(true)}
                      >
                        <Plus size={15} aria-hidden="true" />
                        Subtasks
                      </button>
                    ) : null}
                    {!selectedDetailsTask.comments.length && !showMobileComments ? (
                      <button type="button" onClick={() => setShowMobileComments(true)}>
                        <Plus size={15} aria-hidden="true" />
                        Comments
                      </button>
                    ) : null}
                  </div>
                  <section>
                    <h3>Project</h3>
                    <select
                      className="form-select"
                      aria-label="Project, section, or Inbox"
                      value={
                        detailSectionId === null
                          ? detailProjectId === null
                            ? inboxPlacement
                            : projectPlacement(detailProjectId)
                          : sectionPlacement(detailSectionId)
                      }
                      onChange={async (event) => {
                        const placement = parsePlacement(event.target.value, allSections);
                        setDetailProjectId(placement.projectId);
                        setDetailSectionId(placement.sectionId);
                        setDetailSaveStatus("Saving…");
                        try {
                          await api.moveTask(
                            selectedDetailsTask.id,
                            placement.projectId,
                            placement.sectionId,
                            null,
                            null,
                            null,
                          );
                          await queryClient.invalidateQueries({ queryKey: taskQueryKey });
                          setDetailSaveStatus("Saved");
                        } catch {
                          setDetailProjectId(selectedDetailsTask.projectId);
                          setDetailSectionId(selectedDetailsTask.sectionId);
                          setDetailSaveStatus("Could not save changes");
                        }
                      }}
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
                  </section>
                  <section
                    className={`task-details-optional${!detailDueDate && !showMobileDate ? " task-details-optional-hidden" : ""}`}
                  >
                    <div className="task-details-optional-heading">
                      <h3>Date</h3>
                      <button
                        type="button"
                        className="task-details-mobile-collapse"
                        aria-label="Remove date and hide section"
                        onClick={async () => {
                          setDetailDueDate("");
                          setShowMobileDate(false);
                          await saveTaskDetails({ dueDate: null });
                        }}
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    </div>
                    {detailDueDate ? (
                      <div className="task-detail-meta-value">
                        <button
                          type="button"
                          className={`task-detail-date ${taskDueDateTone(detailDueDate)}`}
                          onClick={() => setDatePickerOpen(true)}
                          title={`Due ${detailDueDate}`}
                        >
                          <CalendarDays size={15} aria-hidden="true" />
                          <span>
                            {isTaskDueToday(detailDueDate)
                              ? "today"
                              : new Date(`${detailDueDate}T00:00:00`).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="task-details-desktop-remove-date"
                          aria-label="Remove date"
                          onClick={async () => {
                            setDetailDueDate("");
                            setShowMobileDate(false);
                            await saveTaskDetails({ dueDate: null });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setShowMobileDate(true);
                          setDatePickerOpen(true);
                        }}
                      >
                        ＋ Add date
                      </button>
                    )}
                  </section>
                  <section
                    className={`task-details-optional${selectedDetailsTask.labels.length === 0 && !showMobileLabels ? " task-details-optional-hidden" : ""}`}
                  >
                    <div className="task-details-optional-heading">
                      <h3>Labels</h3>
                      <button
                        type="button"
                        className="task-details-mobile-collapse"
                        aria-label="Remove all labels and hide section"
                        onClick={() => void closeMobileLabels()}
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    </div>
                    <LabelPicker
                      autoFocus={showMobileLabels && selectedDetailsTask.labels.length === 0}
                      selected={selectedDetailsTask.labels}
                      options={availableLabels}
                      inputLabel="Labels"
                      inputValue={detailLabelInput}
                      onInputChange={setDetailLabelInput}
                      onChange={(labels) => saveTaskDetails({ labels })}
                    />
                  </section>
                  <p className="task-autosave-status" aria-live="polite">
                    {detailSaveStatus}
                  </p>
                </aside>
              </div>
              {datePickerOpen ? (
                <div className="task-date-picker-backdrop">
                  <section
                    className="task-date-picker"
                    role="dialog"
                    aria-modal="true"
                    aria-label={selectedDetailsTask.dueDate ? "Change date" : "Add date"}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        setDetailDueDate(selectedDetailsTask.dueDate ?? "");
                        setDatePickerOpen(false);
                        if (!selectedDetailsTask.dueDate) setShowMobileDate(false);
                      }
                      if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") {
                        event.preventDefault();
                        void saveTaskDetails({ dueDate: detailDueDate || null }).then((saved) => {
                          if (saved) setDatePickerOpen(false);
                        });
                      }
                    }}
                  >
                    <h3>{selectedDetailsTask.dueDate ? "Change date" : "Add date"}</h3>
                    <DatePickerPanel
                      autoFocus
                      inputLabel="New date"
                      value={detailDueDate}
                      onChange={setDetailDueDate}
                    />
                    <div className="task-date-picker-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailDueDate(selectedDetailsTask.dueDate ?? "");
                          setDatePickerOpen(false);
                          if (!selectedDetailsTask.dueDate) setShowMobileDate(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={async () => {
                          if (await saveTaskDetails({ dueDate: detailDueDate || null }))
                            setDatePickerOpen(false);
                        }}
                      >
                        Save date
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
      {taskContextMenu !== null
        ? createPortal(
            <div
              className="task-context-menu"
              role="menu"
              aria-label={`Task actions for ${taskContextMenu.task.title}`}
              style={{ left: taskContextMenu.left, top: taskContextMenu.top }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const task = taskContextMenu.task;
                  setTaskContextMenu(null);
                  openDetails(task);
                }}
              >
                Open
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const task = taskContextMenu.task;
                  setTaskContextMenu(null);
                  startEditing(task);
                }}
              >
                Quick edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const task = taskContextMenu.task;
                  setTaskContextMenu(null);
                  startSubtask(task);
                }}
              >
                Add subtask
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  const task = taskContextMenu.task;
                  setTaskContextMenu(null);
                  requestTaskDelete(task);
                }}
              >
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </DndContext>
  );
};

const AppRouter = () => {
  const api = createTaskApi();
  const authStatus = useQuery({ queryKey: authStatusQueryKey, queryFn: api.getAuthStatus });
  const path = useLocation().pathname;

  if (authStatus.isLoading) {
    return <main className="auth-loading">Loading…</main>;
  }

  if (authStatus.isError || authStatus.data === undefined) {
    return <main className="auth-loading error">Unable to check workspace access.</main>;
  }

  if (authStatus.data.accessMode === "password" && !authStatus.data.authenticated) {
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <LoginPage api={api} />
      </Suspense>
    );
  }

  if (path.startsWith("/attachments") && authStatus.data.attachmentsEnabled !== true)
    return <Navigate to="/" replace />;

  if (path.startsWith("/admin/users")) {
    if (authStatus.data.user?.isAdmin !== true) return <Navigate to="/" replace />;
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <AdminUsersPage api={api} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    );
  }

  if (path.startsWith("/settings")) {
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <SettingsPage api={api} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    );
  }

  if (path.startsWith("/archived-projects"))
    return authStatus.data.projectArchivingEnabled === true ? (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <ArchivedProjectsPage api={api} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    ) : (
      <Navigate to="/" replace />
    );

  if (path.startsWith("/tools")) {
    if (authStatus.data.user?.isAdmin !== true) return <Navigate to="/" replace />;
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <ToolsPage api={createToolsApi()} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    );
  }

  return (
    <TaskApp
      api={api}
      attachmentsEnabled={authStatus.data.attachmentsEnabled === true}
      projectArchivingEnabled={authStatus.data.projectArchivingEnabled === true}
    />
  );
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

export const App = () => (
  <QueryClientProvider client={createQueryClient()}>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </QueryClientProvider>
);
