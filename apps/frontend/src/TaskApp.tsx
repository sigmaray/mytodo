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
import { useFloating } from "@floating-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { Project, ProjectId, Section, SectionId, Task, TaskId, TaskNode } from "@todoist-clone/domain";
import { computeDropPlacement, computeIndentPlacement, computeOutdentPlacement } from "@todoist-clone/domain";
import { Download, Edit3, ListChecks, MoveRight, Plus, Trash2 } from "lucide-react";
import type {
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import "./vendor/bootstrap.min.css";
import type { ApplicationApi } from "./api";
import { AddTaskDialog } from "./components/AddTaskDialog";
import { AppSidebar } from "./components/AppSidebar";
import { AttachmentLibrary } from "./components/AttachmentLibrary";
import { ExportPage } from "./components/ExportPage";
import { TaskAppBoard } from "./components/TaskAppBoard";
import { TaskAppFilteredPage } from "./components/TaskAppFilteredPage";
import { TaskAppOverlays } from "./components/TaskAppOverlays";
import { TaskDetailsDialog } from "./components/TaskDetailsDialog";
import {
  AutoGrowTextarea,
  buildCalendarDays,
  calendarMonthLabel,
  normalizeLabels,
  shiftCalendarMonth,
} from "./components/TaskFormFields";
import { toLocalIsoDate } from "./dateUtils";
import { appendById, removeById, replaceById } from "./queryData";
import {
  inboxDescriptionQueryKey,
  projectQueryKey,
  sectionQueryKey,
  settingsQueryKey,
  taskQueryKey,
} from "./queryKeys";
import {
  allAdvancedMarkdownDocument,
  allMarkdownDocument,
  copyText,
  createPlacementOptions,
  currentAdvancedMarkdown,
  currentMarkdown,
  downloadBlob,
  dragPlacementFromEvent,
  filterTaskTree,
  findTaskNode,
  hasDescendant,
  inboxPlacement,
  parsePlacement,
  projectPlacement,
  sectionPlacement,
  taskPlacement,
} from "./taskAppUtils";
import { flattenTaskNodes } from "./taskTreeUtils";
import { type DropZoneId, useTaskAppState } from "./useTaskAppState";

const pastedFiles = (clipboardData: DataTransfer): ReadonlyArray<File> => {
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return Object.freeze(itemFiles.length > 0 ? itemFiles : Array.from(clipboardData.files));
};

const notifyAttachedFiles = (files: ReadonlyArray<File>) =>
  files.forEach((file) => toast.success(`Файл «${file.name}» прикреплён`));

type MoveInput = Readonly<{
  taskId: TaskId;
  projectId: ProjectId | null;
  sectionId: SectionId | null;
  parentId: TaskId | null;
  beforeId: TaskId | null;
  afterId: TaskId | null;
}>;

export const TaskApp = ({
  api,
  attachmentsEnabled = false,
  projectArchivingEnabled = false,
}: Readonly<{ api: ApplicationApi; attachmentsEnabled?: boolean; projectArchivingEnabled?: boolean }>) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const {
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
  } = useTaskAppState();
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
  const projectRootTasks = allTasks.filter(
    (task) => task.projectId === targetProjectId && task.sectionId === null,
  );
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
  const selectedProject =
    targetProjectId === null ? null : (allProjects.find((item) => item.id === targetProjectId) ?? null);
  const saveProjectTitle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = projectTitleDraft.trim();
    if (selectedProject === null || title.length === 0) return;
    try {
      await updateProjectMutation.mutateAsync({ id: selectedProject.id, title });
      setEditingProjectTitle(false);
      setProjectTitleDraft("");
    } catch {
      toast.error("Could not update project name");
    }
  };
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
  const openAddTaskDialog = (placement: string, beforeId: string | null = null) => {
    setAddTaskPlacement(placement);
    setAddTaskBeforeId(beforeId);
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
            {pageMode === "tasks" && selectedProject !== null ? (
              editingProjectTitle ? (
                <form
                  className="project-title-edit-form"
                  onSubmit={(event) => void saveProjectTitle(event)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingProjectTitle(false);
                      setProjectTitleDraft("");
                    }
                  }}
                >
                  <label className="visually-hidden" htmlFor="project-title-inline-edit">
                    Project title
                  </label>
                  <input
                    id="project-title-inline-edit"
                    autoFocus
                    value={projectTitleDraft}
                    onChange={(event) => setProjectTitleDraft(event.target.value)}
                    aria-label="Project title"
                  />
                  <button
                    type="submit"
                    disabled={projectTitleDraft.trim().length === 0 || updateProjectMutation.isPending}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProjectTitle(false);
                      setProjectTitleDraft("");
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="project-title-heading">
                  <h1>{selectedProject.title}</h1>
                  <button
                    type="button"
                    className="project-title-edit-trigger"
                    aria-label="Edit project name"
                    title="Edit project name"
                    onClick={() => {
                      setProjectTitleDraft(selectedProject.title);
                      setEditingProjectTitle(true);
                    }}
                  >
                    <Edit3 size={18} aria-hidden="true" />
                  </button>
                </div>
              )
            ) : (
              <h1>{viewTitle}</h1>
            )}
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
            <TaskAppFilteredPage
              mode={pageMode}
              viewTitle={viewTitle}
              dateView={dateView}
              setDateView={setDateView}
              dateListFilter={dateListFilter}
              setDateListFilter={setDateListFilter}
              selectedLabel={selectedLabel}
              flatTasks={flatTasks}
              calendarMonth={calendarMonth}
              calendarLabel={calendarLabel}
              calendarDays={calendarDays}
              calendarTasks={calendarTasks}
              calendarTaskCount={calendarTaskCount}
              activeCalendarDate={activeCalendarDate}
              calendarTaskLocation={calendarTaskLocation}
              setCalendarMonth={setCalendarMonth}
              shiftCalendarMonth={(amount) => setCalendarMonth((month) => shiftCalendarMonth(month, amount))}
              onToday={() => setCalendarMonth(toLocalIsoDate(new Date()).slice(0, 7))}
              onMarkDate={markCalendarDate}
              onDropDate={dropTaskOnCalendarDate}
              onLeaveDate={() => setActiveCalendarDate(null)}
              onTaskDragStart={(task, event) => {
                calendarDraggedTaskRef.current = task.id;
                setDraggingTaskId(task.id);
                event.dataTransfer.setData("text/task-id", task.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onTaskDragEnd={() => {
                calendarDraggedTaskRef.current = null;
                setDraggingTaskId(null);
                setActiveCalendarDate(null);
              }}
              onTaskOpen={(task) => {
                const node = findTaskNode(allTasks, task.id);
                if (node) openDetails(node);
              }}
              viewTasks={viewTasks}
              taskActions={taskActions}
            />
          ) : pageMode === "attachments" && attachmentsEnabled ? (
            <AttachmentLibrary
              attachments={taskAttachments}
              loading={tasks.isLoading}
              onTaskOpen={(taskId) => {
                const task = findTaskNode(allTasks, taskId);
                if (task !== null) openDetails(task);
              }}
            />
          ) : pageMode === "export" ? (
            <ExportPage
              copyStatus={copyStatus}
              onExport={(kind) => {
                if (kind === "markdown") exportMarkdown();
                else if (kind === "advancedMarkdown") exportAdvancedMarkdown();
                else
                  downloadBlob(
                    new Blob([allJson], { type: "application/json;charset=utf-8" }),
                    "mytodo.json",
                  );
              }}
              onCopy={async (kind) => {
                const content =
                  kind === "markdown"
                    ? allMarkdown
                    : kind === "advancedMarkdown"
                      ? allAdvancedMarkdown
                      : allJson;
                await copyText(content);
                setCopyStatus(
                  kind === "markdown"
                    ? "All markdown copied"
                    : kind === "advancedMarkdown"
                      ? "All advanced markdown copied"
                      : "All JSON copied",
                );
              }}
              onPreview={(kind) => {
                const content =
                  kind === "markdown"
                    ? allMarkdown
                    : kind === "advancedMarkdown"
                      ? allAdvancedMarkdown
                      : allJson;
                setMarkdownModal(
                  Object.freeze({
                    title: kind === "json" ? "All data" : "All tasks",
                    markdown: content,
                    format: kind === "advancedMarkdown" ? "advanced-markdown" : kind,
                  }),
                );
              }}
            />
          ) : (
            <TaskAppBoard
              targetProjectId={targetProjectId}
              scopeDescriptionBlock={scopeDescriptionBlock}
              activeDropZone={activeDropZone}
              clearDropZone={() => setActiveDropZone(null)}
              markDropZone={markDropZone}
              moveDroppedTask={moveDroppedTask}
              inboxRootTasks={inboxRootTasks}
              projectRootTasks={projectRootTasks}
              openAddTaskDialog={openAddTaskDialog}
              addingSection={addingSection}
              setAddingSection={setAddingSection}
              submitSection={submitSection}
              cancelSectionCreate={cancelSectionCreate}
              sectionTitle={sectionTitle}
              setSectionTitle={setSectionTitle}
              sectionCreateInputRef={sectionCreateInputRef}
              inboxSections={inboxSections}
              projectSections={projectSections}
              allTasks={allTasks}
              draggingSectionId={draggingSectionId}
              setDraggingSectionId={setDraggingSectionId}
              activeSectionDrop={activeSectionDrop}
              setActiveSectionDrop={setActiveSectionDrop}
              editSectionId={editSectionId}
              setEditSectionId={setEditSectionId}
              editSectionTitle={editSectionTitle}
              setEditSectionTitle={setEditSectionTitle}
              startSectionDrag={startSectionDrag}
              markSectionDrop={markSectionDrop}
              dropSection={dropSection}
              submitSectionEdit={submitSectionEdit}
              requestSectionDelete={requestSectionDelete}
              startSectionEdit={startSectionEdit}
              taskActions={taskActions}
              taskTargetLabel={taskTargetLabel}
            />
          )}{" "}
          {pageMode === "tasks" ? selectionToolbar : null}
        </section>
        <TaskAppOverlays
          selectedMoveOpen={selectedMoveOpen}
          setSelectedMoveOpen={setSelectedMoveOpen}
          selectedRootTasks={selectedRootTasks}
          selectedMovePlacement={selectedMovePlacement}
          setSelectedMovePlacement={setSelectedMovePlacement}
          activeProjects={activeProjects}
          allSections={allSections}
          selectedMovePending={selectedMoveMutation.isPending}
          moveSelectedTasks={moveSelectedTasks}
          markdownModal={markdownModal}
          setMarkdownModal={setMarkdownModal}
          markdownFloating={markdownFloating}
          scopeExportOpen={scopeExportOpen}
          setScopeExportOpen={setScopeExportOpen}
          targetProjectId={targetProjectId}
          scopeProject={scopeProject}
          taskTargetLabel={taskTargetLabel}
          markdown={markdown}
          advancedMarkdown={advancedMarkdown}
          scopeJson={scopeJson}
          copyStatus={copyStatus}
          setCopyStatus={setCopyStatus}
        />
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
            if (addTaskBeforeId !== null)
              await api.moveTask(
                created.id,
                placement.projectId,
                placement.sectionId,
                null,
                addTaskBeforeId,
                null,
              );
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
            setAddTaskBeforeId(null);
          }}
        />
        <TaskDetailsDialog
          api={api}
          queryClient={queryClient}
          attachmentsEnabled={attachmentsEnabled}
          selectedDetailsTask={selectedDetailsTask}
          selectedDetailsProject={selectedDetailsProject}
          selectedDetailsSection={selectedDetailsSection}
          selectedDetailsParent={selectedDetailsParent}
          activeProjects={activeProjects}
          allSections={allSections}
          availableLabels={availableLabels}
          detailTitle={detailTitle}
          detailDescription={detailDescription}
          detailDueDate={detailDueDate}
          detailLabelInput={detailLabelInput}
          detailSaveStatus={detailSaveStatus}
          detailProjectId={detailProjectId}
          detailSectionId={detailSectionId}
          editingDetailField={editingDetailField}
          datePickerOpen={datePickerOpen}
          showMobileLabels={showMobileLabels}
          showMobileComments={showMobileComments}
          showMobileDate={showMobileDate}
          showMobileSubtasks={showMobileSubtasks}
          detailComment={detailComment}
          detailCommentFiles={detailCommentFiles}
          detailSubtask={detailSubtask}
          editingCommentId={editingCommentId}
          editingCommentBody={editingCommentBody}
          subtasksSectionRef={subtasksSectionRef}
          setDetailsTaskId={setDetailsTaskId}
          setDetailTitle={setDetailTitle}
          setDetailDescription={setDetailDescription}
          setDetailDueDate={setDetailDueDate}
          setDetailLabelInput={setDetailLabelInput}
          setDetailSaveStatus={setDetailSaveStatus}
          setDetailProjectId={setDetailProjectId}
          setDetailSectionId={setDetailSectionId}
          setEditingDetailField={setEditingDetailField}
          setDatePickerOpen={setDatePickerOpen}
          setShowMobileLabels={setShowMobileLabels}
          setShowMobileComments={setShowMobileComments}
          setShowMobileDate={setShowMobileDate}
          setShowMobileSubtasks={setShowMobileSubtasks}
          setDetailComment={setDetailComment}
          setDetailCommentFiles={setDetailCommentFiles}
          setDetailSubtask={setDetailSubtask}
          setEditingCommentId={setEditingCommentId}
          setEditingCommentBody={setEditingCommentBody}
          confirmDeletion={confirmDeletion}
          saveTaskDetails={saveTaskDetails}
          removeCommentAttachment={removeCommentAttachment}
          closeMobileLabels={closeMobileLabels}
          closeMobileComments={closeMobileComments}
          closeMobileSubtasks={closeMobileSubtasks}
          openDetails={openDetails}
          notifyAttachedFiles={notifyAttachedFiles}
          pastedFiles={pastedFiles}
        />
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
