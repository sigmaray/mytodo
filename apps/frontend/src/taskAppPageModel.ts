import type { Task } from "@todoist-clone/domain";
import type { DragEvent } from "react";
import type { TaskAppBoardProps } from "./components/TaskAppBoardTypes";
import type { useTaskAppActions } from "./useTaskAppActions";
import type { useTaskAppState } from "./useTaskAppState";
import type { useTaskAppViewModel } from "./useTaskAppViewModel";
import type { AttachmentsPageProps } from "./pages/AttachmentsPage";
import type { DatesPageProps } from "./pages/DatesPage";
import type { ExportKind, ExportPageProps } from "./pages/ExportPage";
import type { LabelsPageProps } from "./pages/LabelsPage";
import { copyText, downloadBlob, findTaskNode } from "./taskAppUtils";
import { shiftCalendarMonth } from "./components/TaskFormFields";
import { toLocalIsoDate } from "./dateUtils";

export type TaskAppPageModel =
  | { mode: "dates"; props: DatesPageProps }
  | { mode: "labels"; props: LabelsPageProps }
  | { mode: "attachments"; props: AttachmentsPageProps }
  | { mode: "export"; props: ExportPageProps }
  | { mode: "inbox"; props: TaskAppBoardProps };

type TaskAppPageModelInput = {
  attachmentsEnabled: boolean;
  tasksLoading: boolean;
  state: ReturnType<typeof useTaskAppState>;
  actions: ReturnType<typeof useTaskAppActions>;
  viewModel: ReturnType<typeof useTaskAppViewModel>;
};

export const createTaskAppPageModel = ({
  attachmentsEnabled,
  tasksLoading,
  state,
  actions,
  viewModel,
}: TaskAppPageModelInput): TaskAppPageModel => {
  const {
    dateView,
    setDateView,
    dateListFilter,
    setDateListFilter,
    calendarMonth,
    setCalendarMonth,
    activeCalendarDate,
    setActiveCalendarDate,
    setDraggingTaskId,
    setMarkdownModal,
    setCopyStatus,
    copyStatus,
    calendarDraggedTaskRef,
    targetProjectId,
    activeDropZone,
    setActiveDropZone,
    addingSection,
    setAddingSection,
    sectionTitle,
    setSectionTitle,
    sectionCreateInputRef,
    draggingSectionId,
    setDraggingSectionId,
    activeSectionDrop,
    setActiveSectionDrop,
    editSectionId,
    setEditSectionId,
    editSectionTitle,
    setEditSectionTitle,
  } = state;
  const {
    allTasks,
    flatTasks,
    markCalendarDate,
    dropTaskOnCalendarDate,
    openDetails,
    markDropZone,
    moveDroppedTask,
    submitSection,
    cancelSectionCreate,
    startSectionDrag,
    markSectionDrop,
    dropSection,
    submitSectionEdit,
    requestSectionDelete,
    startSectionEdit,
  } = actions;
  const {
    pageMode,
    viewTitle,
    selectedLabel,
    viewTasks,
    calendarTasks,
    calendarDays,
    calendarLabel,
    calendarTaskCount,
    calendarTaskLocation,
    taskActions,
    taskAttachments,
    scopeDescriptionBlock,
    inboxRootTasks,
    projectRootTasks,
    openAddTaskDialog,
    inboxSections,
    projectSections,
    taskTargetLabel,
    exportMarkdown,
    exportAdvancedMarkdown,
    allMarkdown,
    allJson,
    allAdvancedMarkdown,
  } = viewModel;

  if (pageMode === "dates") {
    return {
      mode: "dates",
      props: {
        dateView,
        setDateView,
        dateListFilter,
        setDateListFilter,
        calendarMonth,
        calendarLabel,
        calendarDays,
        calendarTasks,
        calendarTaskCount,
        activeCalendarDate,
        calendarTaskLocation,
        setCalendarMonth,
        shiftCalendarMonth: (amount: number) =>
          setCalendarMonth((month) => shiftCalendarMonth(month, amount)),
        onToday: () => setCalendarMonth(toLocalIsoDate(new Date()).slice(0, 7)),
        onMarkDate: markCalendarDate,
        onDropDate: dropTaskOnCalendarDate,
        onLeaveDate: () => setActiveCalendarDate(null),
        onTaskDragStart: (task: Task, event: DragEvent<HTMLButtonElement>) => {
          calendarDraggedTaskRef.current = task.id;
          setDraggingTaskId(task.id);
          event.dataTransfer.setData("text/task-id", task.id);
          event.dataTransfer.effectAllowed = "move";
        },
        onTaskDragEnd: () => {
          calendarDraggedTaskRef.current = null;
          setDraggingTaskId(null);
          setActiveCalendarDate(null);
        },
        onTaskOpen: (task: Task) => {
          const node = findTaskNode(allTasks, task.id);
          if (node !== null) openDetails(node);
        },
        viewTasks,
        taskActions,
      },
    };
  }

  if (pageMode === "labels")
    return {
      mode: "labels",
      props: { selectedLabel, viewTitle, flatTasks, viewTasks, taskActions },
    };

  if (pageMode === "attachments" && attachmentsEnabled)
    return {
      mode: "attachments",
      props: {
        attachments: taskAttachments,
        loading: tasksLoading,
        onTaskOpen: (taskId: string) => {
          const task = findTaskNode(allTasks, taskId);
          if (task !== null) openDetails(task);
        },
      },
    };

  if (pageMode === "export")
    return {
      mode: "export",
      props: {
        copyStatus,
        onExport: (kind: ExportKind) => {
          if (kind === "markdown") exportMarkdown();
          else if (kind === "advancedMarkdown") exportAdvancedMarkdown();
          else downloadBlob(new Blob([allJson], { type: "application/json;charset=utf-8" }), "mytodo.json");
        },
        onCopy: async (kind: ExportKind) => {
          const content =
            kind === "markdown" ? allMarkdown : kind === "advancedMarkdown" ? allAdvancedMarkdown : allJson;
          await copyText(content);
          setCopyStatus(
            kind === "markdown"
              ? "All markdown copied"
              : kind === "advancedMarkdown"
                ? "All advanced markdown copied"
                : "All JSON copied",
          );
        },
        onPreview: (kind: ExportKind) => {
          const content =
            kind === "markdown" ? allMarkdown : kind === "advancedMarkdown" ? allAdvancedMarkdown : allJson;
          setMarkdownModal({
            title: kind === "json" ? "All data" : "All tasks",
            markdown: content,
            format: kind === "advancedMarkdown" ? "advanced-markdown" : kind,
          });
        },
      },
    };

  return {
    mode: "inbox",
    props: {
      targetProjectId,
      scopeDescriptionBlock,
      activeDropZone,
      clearDropZone: () => setActiveDropZone(null),
      markDropZone,
      moveDroppedTask,
      inboxRootTasks,
      projectRootTasks,
      openAddTaskDialog,
      addingSection,
      setAddingSection,
      submitSection,
      cancelSectionCreate,
      sectionTitle,
      setSectionTitle,
      sectionCreateInputRef,
      inboxSections,
      projectSections,
      allTasks,
      draggingSectionId,
      setDraggingSectionId,
      activeSectionDrop,
      setActiveSectionDrop,
      editSectionId,
      setEditSectionId,
      editSectionTitle,
      setEditSectionTitle,
      startSectionDrag,
      markSectionDrop,
      dropSection,
      submitSectionEdit,
      requestSectionDelete,
      startSectionEdit,
      taskActions,
      taskTargetLabel,
    },
  };
};
