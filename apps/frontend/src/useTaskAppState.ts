import type { ProjectId, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import { useRef, useState } from "react";
import type { TaskAppMarkdownModal } from "./components/TaskAppOverlays";
import type { ActiveDragTarget } from "./components/TaskTreeView";
import { inboxPlacement } from "./taskAppUtils";

type MobileDragItem = { id: string };

export type DropZoneId = "inbox" | `project:${ProjectId}` | `section:${SectionId}`;

type TaskContextMenuState = {
  task: TaskNode;
  left: number;
  top: number;
};

export const useTaskAppState = () => {
  const [dateView, setDateView] = useState<"list" | "calendar">("list");
  const [dateListFilter, setDateListFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [activeCalendarDate, setActiveCalendarDate] = useState<string | null>(null);
  const calendarDraggedTaskRef = useRef<TaskId | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskDescription, setAddTaskDescription] = useState("");
  const [addTaskFiles, setAddTaskFiles] = useState<Array<File>>([]);
  const [addTaskDate, setAddTaskDate] = useState("");
  const [addTaskDatePickerOpen, setAddTaskDatePickerOpen] = useState(false);
  const [addTaskDateBeforePicker, setAddTaskDateBeforePicker] = useState("");
  const [addTaskLabels, setAddTaskLabels] = useState<Array<string>>([]);
  const [addTaskLabelInput, setAddTaskLabelInput] = useState("");
  const [showAddTaskDescription, setShowAddTaskDescription] = useState(false);
  const [showAddTaskDate, setShowAddTaskDate] = useState(false);
  const [showAddTaskLabels, setShowAddTaskLabels] = useState(false);
  const [addTaskPlacement, setAddTaskPlacement] = useState(inboxPlacement);
  const [addTaskBeforeId, setAddTaskBeforeId] = useState<string | null>(null);
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
  const [activeSectionDrop, setActiveSectionDrop] = useState<{
    id: SectionId;
    position: "before" | "after";
  } | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<SectionId | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<ProjectId | null>(() =>
    new URLSearchParams(window.location.search).get("project"),
  );
  const [editingProjectTitle, setEditingProjectTitle] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [targetSectionId, setTargetSectionId] = useState<SectionId | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPlacement, setEditPlacement] = useState(inboxPlacement);
  const [markdownModal, setMarkdownModal] = useState<TaskAppMarkdownModal | null>(null);
  const [scopeExportOpen, setScopeExportOpen] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState<TaskId | null>(null);
  const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenuState | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRootTaskIds, setSelectedRootTaskIds] = useState<Array<TaskId>>([]);
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
  const [detailCommentFiles, setDetailCommentFiles] = useState<Array<File>>([]);
  const pastedCommentSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [detailSubtask, setDetailSubtask] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [openProjectMenuId, setOpenProjectMenuId] = useState<ProjectId | null>(null);
  const [editingScopeDescription, setEditingScopeDescription] = useState(false);
  const [scopeDescriptionDraft, setScopeDescriptionDraft] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  return {
    dateView,
    setDateView,
    dateListFilter,
    setDateListFilter,
    calendarMonth,
    setCalendarMonth,
    activeCalendarDate,
    setActiveCalendarDate,
    addTaskOpen,
    setAddTaskOpen,
    addTaskTitle,
    setAddTaskTitle,
    addTaskDescription,
    setAddTaskDescription,
    addTaskFiles,
    setAddTaskFiles,
    addTaskDate,
    setAddTaskDate,
    addTaskDatePickerOpen,
    setAddTaskDatePickerOpen,
    addTaskDateBeforePicker,
    setAddTaskDateBeforePicker,
    addTaskLabels,
    setAddTaskLabels,
    addTaskLabelInput,
    setAddTaskLabelInput,
    showAddTaskDescription,
    setShowAddTaskDescription,
    showAddTaskDate,
    setShowAddTaskDate,
    showAddTaskLabels,
    setShowAddTaskLabels,
    addTaskPlacement,
    setAddTaskPlacement,
    addTaskBeforeId,
    setAddTaskBeforeId,
    sectionTitle,
    setSectionTitle,
    addingSection,
    setAddingSection,
    editSectionId,
    setEditSectionId,
    editSectionTitle,
    setEditSectionTitle,
    subtaskTitle,
    setSubtaskTitle,
    subtaskParentId,
    setSubtaskParentId,
    draggingTaskId,
    setDraggingTaskId,
    activeDragTarget,
    setActiveDragTarget,
    activeDropZone,
    setActiveDropZone,
    activeSectionDrop,
    setActiveSectionDrop,
    draggingSectionId,
    setDraggingSectionId,
    targetProjectId,
    setTargetProjectId,
    editingProjectTitle,
    setEditingProjectTitle,
    projectTitleDraft,
    setProjectTitleDraft,
    targetSectionId,
    setTargetSectionId,
    editTaskId,
    setEditTaskId,
    editTitle,
    setEditTitle,
    editPlacement,
    setEditPlacement,
    markdownModal,
    setMarkdownModal,
    scopeExportOpen,
    setScopeExportOpen,
    detailsTaskId,
    setDetailsTaskId,
    taskContextMenu,
    setTaskContextMenu,
    selectionMode,
    setSelectionMode,
    selectedRootTaskIds,
    setSelectedRootTaskIds,
    selectedMoveOpen,
    setSelectedMoveOpen,
    selectedMovePlacement,
    setSelectedMovePlacement,
    detailTitle,
    setDetailTitle,
    detailDescription,
    setDetailDescription,
    detailDueDate,
    setDetailDueDate,
    detailLabelInput,
    setDetailLabelInput,
    detailSaveStatus,
    setDetailSaveStatus,
    detailProjectId,
    setDetailProjectId,
    detailSectionId,
    setDetailSectionId,
    editingDetailField,
    setEditingDetailField,
    datePickerOpen,
    setDatePickerOpen,
    showMobileLabels,
    setShowMobileLabels,
    showMobileComments,
    setShowMobileComments,
    showMobileDate,
    setShowMobileDate,
    showMobileSubtasks,
    setShowMobileSubtasks,
    detailComment,
    setDetailComment,
    detailCommentFiles,
    setDetailCommentFiles,
    detailSubtask,
    setDetailSubtask,
    editingCommentId,
    setEditingCommentId,
    editingCommentBody,
    setEditingCommentBody,
    openProjectMenuId,
    setOpenProjectMenuId,
    editingScopeDescription,
    setEditingScopeDescription,
    scopeDescriptionDraft,
    setScopeDescriptionDraft,
    copyStatus,
    setCopyStatus,
    calendarDraggedTaskRef,
    mobileDragRef,
    subtasksSectionRef,
    sectionCreateInputRef,
    pastedCommentSaveQueueRef,
  };
};
