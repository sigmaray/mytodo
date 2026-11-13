import type { ProjectId, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import { useRef, useState } from "react";
import type { TaskAppMarkdownModal } from "./components/TaskAppOverlays";
import type { ActiveDragTarget } from "./components/TaskTreeView";
import { inboxPlacement } from "./taskAppUtils";

type MobileDragItem = { id: string };
export type DropZoneId = "inbox" | `project:${ProjectId}` | `section:${SectionId}`;
type TaskContextMenuState = { task: TaskNode; left: number; top: number };

export const useCalendarState = () => {
  const [dateView, setDateView] = useState<"list" | "calendar">("list");
  const [dateListFilter, setDateListFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [activeCalendarDate, setActiveCalendarDate] = useState<string | null>(null);
  const calendarDraggedTaskRef = useRef<TaskId | null>(null);
  return {
    dateView,
    dateListFilter,
    calendarMonth,
    activeCalendarDate,
    calendarDraggedTaskRef,
    setDateView,
    setDateListFilter,
    setCalendarMonth,
    setActiveCalendarDate,
  };
};

export const useAddTaskState = () => {
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
  return {
    addTaskOpen,
    addTaskTitle,
    addTaskDescription,
    addTaskFiles,
    addTaskDate,
    addTaskDatePickerOpen,
    addTaskDateBeforePicker,
    addTaskLabels,
    addTaskLabelInput,
    showAddTaskDescription,
    showAddTaskDate,
    showAddTaskLabels,
    addTaskPlacement,
    addTaskBeforeId,
    setAddTaskOpen,
    setAddTaskTitle,
    setAddTaskDescription,
    setAddTaskFiles,
    setAddTaskDate,
    setAddTaskDatePickerOpen,
    setAddTaskDateBeforePicker,
    setAddTaskLabels,
    setAddTaskLabelInput,
    setShowAddTaskDescription,
    setShowAddTaskDate,
    setShowAddTaskLabels,
    setAddTaskPlacement,
    setAddTaskBeforeId,
  };
};

export const useSectionsState = () => {
  const [sectionTitle, setSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [editSectionId, setEditSectionId] = useState<SectionId | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const sectionCreateInputRef = useRef<HTMLInputElement>(null);
  return {
    sectionTitle,
    addingSection,
    editSectionId,
    editSectionTitle,
    sectionCreateInputRef,
    setSectionTitle,
    setAddingSection,
    setEditSectionId,
    setEditSectionTitle,
  };
};

export const useSubtasksState = () => {
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  return { subtaskTitle, subtaskParentId, setSubtaskTitle, setSubtaskParentId };
};

export const useDragState = () => {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [activeDragTarget, setActiveDragTarget] = useState<ActiveDragTarget | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<DropZoneId | null>(null);
  const mobileDragRef = useRef<MobileDragItem | null>(null);
  const [activeSectionDrop, setActiveSectionDrop] = useState<{
    id: SectionId;
    position: "before" | "after";
  } | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<SectionId | null>(null);
  return {
    draggingTaskId,
    activeDragTarget,
    activeDropZone,
    mobileDragRef,
    activeSectionDrop,
    draggingSectionId,
    setDraggingTaskId,
    setActiveDragTarget,
    setActiveDropZone,
    setActiveSectionDrop,
    setDraggingSectionId,
  };
};

export const useProjectsState = () => {
  const [targetProjectId, setTargetProjectId] = useState<ProjectId | null>(() =>
    new URLSearchParams(window.location.search).get("project"),
  );
  const [editingProjectTitle, setEditingProjectTitle] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [targetSectionId, setTargetSectionId] = useState<SectionId | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<ProjectId | null>(null);
  return {
    targetProjectId,
    editingProjectTitle,
    projectTitleDraft,
    targetSectionId,
    openProjectMenuId,
    setTargetProjectId,
    setEditingProjectTitle,
    setProjectTitleDraft,
    setTargetSectionId,
    setOpenProjectMenuId,
  };
};

export const useTaskEditingState = () => {
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPlacement, setEditPlacement] = useState(inboxPlacement);
  return { editTaskId, editTitle, editPlacement, setEditTaskId, setEditTitle, setEditPlacement };
};

export const useExportsState = () => {
  const [markdownModal, setMarkdownModal] = useState<TaskAppMarkdownModal | null>(null);
  const [scopeExportOpen, setScopeExportOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  return { markdownModal, scopeExportOpen, copyStatus, setMarkdownModal, setScopeExportOpen, setCopyStatus };
};

export const useSelectionState = () => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRootTaskIds, setSelectedRootTaskIds] = useState<Array<TaskId>>([]);
  const [selectedMoveOpen, setSelectedMoveOpen] = useState(false);
  const [selectedMovePlacement, setSelectedMovePlacement] = useState(inboxPlacement);
  return {
    selectionMode,
    selectedRootTaskIds,
    selectedMoveOpen,
    selectedMovePlacement,
    setSelectionMode,
    setSelectedRootTaskIds,
    setSelectedMoveOpen,
    setSelectedMovePlacement,
  };
};

export const useDetailsState = () => {
  const [detailsTaskId, setDetailsTaskId] = useState<TaskId | null>(null);
  const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenuState | null>(null);
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
  const [detailComment, setDetailComment] = useState("");
  const [detailCommentFiles, setDetailCommentFiles] = useState<Array<File>>([]);
  const pastedCommentSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [detailSubtask, setDetailSubtask] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  return {
    detailsTaskId,
    taskContextMenu,
    detailTitle,
    detailDescription,
    detailDueDate,
    detailLabelInput,
    detailSaveStatus,
    detailProjectId,
    detailSectionId,
    editingDetailField,
    datePickerOpen,
    showMobileLabels,
    showMobileComments,
    showMobileDate,
    showMobileSubtasks,
    subtasksSectionRef,
    detailComment,
    detailCommentFiles,
    pastedCommentSaveQueueRef,
    detailSubtask,
    editingCommentId,
    editingCommentBody,
    setDetailsTaskId,
    setTaskContextMenu,
    setDetailTitle,
    setDetailDescription,
    setDetailDueDate,
    setDetailLabelInput,
    setDetailSaveStatus,
    setDetailProjectId,
    setDetailSectionId,
    setEditingDetailField,
    setDatePickerOpen,
    setShowMobileLabels,
    setShowMobileComments,
    setShowMobileDate,
    setShowMobileSubtasks,
    setDetailComment,
    setDetailCommentFiles,
    setDetailSubtask,
    setEditingCommentId,
    setEditingCommentBody,
  };
};

export const useScopeDescriptionState = () => {
  const [editingScopeDescription, setEditingScopeDescription] = useState(false);
  const [scopeDescriptionDraft, setScopeDescriptionDraft] = useState("");
  return {
    editingScopeDescription,
    scopeDescriptionDraft,
    setEditingScopeDescription,
    setScopeDescriptionDraft,
  };
};
