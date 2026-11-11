import type { QueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, Section, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import { computeDropPlacement, computeIndentPlacement, computeOutdentPlacement } from "@todoist-clone/domain";
import type { DragEvent, FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect } from "react";
import type { ApplicationApi } from "./api";
import { normalizeLabels } from "./components/TaskFormFields";
import { taskQueryKey } from "./queryKeys";
import {
  dragPlacementFromEvent,
  findTaskNode,
  hasDescendant,
  inboxPlacement,
  projectPlacement,
  taskPlacement,
} from "./taskAppUtils";
import { flattenTaskNodes } from "./taskTreeUtils";
import { useTaskAppMutations } from "./useTaskAppMutations";
import type { DropZoneId, useTaskAppState } from "./useTaskAppState";

type TaskAppState = ReturnType<typeof useTaskAppState>;
type TaskAppActionInput = Readonly<{
  api: ApplicationApi;
  queryClient: QueryClient;
  state: TaskAppState;
  attachmentsEnabled: boolean;
  projectArchivingEnabled: boolean;
  taskData: ReadonlyArray<TaskNode> | undefined;
  projectData: ReadonlyArray<Project> | undefined;
  sectionData: ReadonlyArray<Section> | undefined;
  settings: Readonly<{ confirmDelete: boolean }> | undefined;
}>;

export const useTaskAppActions = ({
  api,
  queryClient,
  state,
  attachmentsEnabled,
  projectArchivingEnabled,
  taskData,
  projectData,
  sectionData,
  settings,
}: TaskAppActionInput) => {
  const {
    setActiveCalendarDate,
    setAddTaskOpen,
    setAddTaskPlacement,
    sectionTitle,
    setSectionTitle,
    setAddingSection,
    setEditSectionId,
    editSectionTitle,
    setEditSectionTitle,
    subtaskTitle,
    setSubtaskTitle,
    setSubtaskParentId,
    setDraggingTaskId,
    setActiveDragTarget,
    setActiveDropZone,
    setActiveSectionDrop,
    draggingSectionId,
    setDraggingSectionId,
    targetProjectId,
    setEditTaskId,
    editTitle,
    setEditTitle,
    setEditPlacement,
    detailsTaskId,
    setDetailsTaskId,
    selectionMode,
    setSelectionMode,
    selectedRootTaskIds,
    setSelectedRootTaskIds,
    setSelectedMoveOpen,
    setDetailTitle,
    setDetailDescription,
    setDetailDueDate,
    setDetailLabelInput,
    setDetailSaveStatus,
    detailProjectId,
    setDetailProjectId,
    setDetailSectionId,
    setEditingDetailField,
    setDatePickerOpen,
    setShowMobileLabels,
    setShowMobileComments,
    setShowMobileDate,
    setShowMobileSubtasks,
    setDetailComment,
    setDetailSubtask,
    setEditingCommentId,
    calendarDraggedTaskRef,
    mobileDragRef,
  } = state;

  const mutations = useTaskAppMutations({ api, queryClient, state, sectionData, settings });
  const {
    confirmDeletion,
    createSubtaskMutation,
    updateProjectMutation,
    reorderSectionMutation,
    createSectionMutation,
    updateSectionMutation,
    requestSectionDelete,
    toggleMutation,
    editMutation,
    requestTaskDelete,
    moveMutation,
    selectedMoveMutation,
    selectedDeleteMutation,
  } = mutations;

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

  const allTasks = taskData ?? Object.freeze([]);
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
  const allProjects = projectData ?? Object.freeze([]);
  const activeProjects = allProjects.filter((project) => !projectArchivingEnabled || !project.archived);
  const allSections = sectionData ?? Object.freeze([]);
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
  return Object.freeze({
    confirmDeletion,
    updateProjectMutation,
    requestSectionDelete,
    toggleMutation,
    requestTaskDelete,
    selectedMoveMutation,
    selectedDeleteMutation,
    submitSection,
    cancelSectionCreate,
    submitSectionEdit,
    startSectionEdit,
    startSubtask,
    submitSubtask,
    markDropZone,
    moveDroppedTask,
    startSectionDrag,
    markSectionDrop,
    dropSection,
    startMobileTaskDrag,
    moveMobileDrag,
    finishMobileDrag,
    cancelMobileDrag,
    dropTaskOnCalendarDate,
    markCalendarDate,
    startDragging,
    moveTaskOntoTask,
    markDragTarget,
    handleTaskKeys,
    startEditing,
    openDetails,
    submitEdit,
    allTasks,
    flatTasks,
    selectedRootTasks,
    selectedTaskIds,
    clearSelection,
    toggleTaskSelection,
    availableLabels,
    allProjects,
    activeProjects,
    allSections,
    selectedDetailsTask,
    selectedDetailsProject,
    selectedDetailsSection,
    selectedDetailsParent,
    saveTaskDetails,
    removeCommentAttachment,
    closeMobileLabels,
    closeMobileComments,
    closeMobileSubtasks,
  });
};
