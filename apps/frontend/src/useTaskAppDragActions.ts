import type { QueryClient } from "@tanstack/react-query";
import type { ProjectId, Section, SectionId, Task, TaskId, TaskNode } from "@todoist-clone/domain";
import { computeDropPlacement, computeIndentPlacement, computeOutdentPlacement } from "@todoist-clone/domain";
import type { DragEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { ApplicationApi } from "./api";
import { taskQueryKey } from "./queryKeys";
import { dragPlacementFromEvent, findTaskNode, hasDescendant, inboxPlacement } from "./taskAppUtils";
import type { useTaskAppMutations } from "./useTaskAppMutations";
import type { DropZoneId, TaskAppDragState } from "./useTaskAppState";

/**
 * Data required to handle task and section drag operations.
 *
 * @typedef {Object} TaskAppDragActionInput
 * @property {ApplicationApi} api - API operations for server data.
 * @property {QueryClient} queryClient - Cache client for server queries.
 * @property {TaskAppDragState} state - Current workspace data.
 * @property {ReturnType<typeof useTaskAppMutations>} mutations - Mutations used to save changes on the server.
 * @property {Array<TaskNode>} allTasks - All tasks, including nested tasks.
 * @property {Array<Task>} flatTasks - Flat task list used for searching and sorting.
 * @property {Array<Section>} allSections - All sections available for task placement.
 */
type TaskAppDragActionInput = {
  api: ApplicationApi;

  queryClient: QueryClient;

  state: TaskAppDragState;

  mutations: ReturnType<typeof useTaskAppMutations>;

  allTasks: Array<TaskNode>;

  flatTasks: Array<Task>;

  allSections: Array<Section>;
};

/**
 * Creates drag and drop handlers for mouse, keyboard, and mobile input.
 *
 * @param {TaskAppDragActionInput} parameter1
 * @returns Drag and drop action handlers.
 */
export const createTaskAppDragActions = ({
  api,
  queryClient,
  state,
  mutations,
  allTasks,
  flatTasks,
  allSections,
}: TaskAppDragActionInput) => {
  const {
    setActiveCalendarDate,
    setDraggingTaskId,
    setActiveDropZone,
    setActiveSectionDrop,
    draggingSectionId,
    setDraggingSectionId,
    setActiveDragTarget,
    selectionMode,
    selectedRootTaskIds,
    calendarDraggedTaskRef,
    mobileDragRef,
  } = state;
  const { moveMutation, selectedMoveMutation, reorderSectionMutation } = mutations;
  const dropZoneId = (projectId: ProjectId | null, sectionId: SectionId | null): DropZoneId =>
    sectionId !== null ? `section:${sectionId}` : projectId !== null ? `project:${projectId}` : "inbox";

  const markDropZone =
    (projectId: ProjectId | null, sectionId: SectionId | null) => (event: DragEvent<HTMLElement>) => {
      /** Ignore unrelated drag data and handle only task payloads from this application. */
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
            /** A valid group payload moves the selected root tasks. */
            const taskIds = JSON.parse(taskIdsJson) as Array<TaskId>;
            if (taskIds.length > 0) selectedMoveMutation.mutate({ taskIds, projectId, sectionId });
          } catch {
            /** If the group payload is malformed, still move the single task. */
            moveMutation.mutate({
              taskId,
              projectId,
              sectionId,
              parentId: null,
              beforeId: null,
              afterId: null,
            });
          }
        } else {
          moveMutation.mutate({
            taskId,
            projectId,
            sectionId,
            parentId: null,
            beforeId: null,
            afterId: null,
          });
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
    setActiveSectionDrop({
      id: section.id,
      position: event.clientY < rect.top + rect.height / 2 ? "before" : "after",
    });
  };
  const dropSection = (section: Section, siblings: Array<Section>) => (event: DragEvent<HTMLElement>) => {
    const draggedId = event.dataTransfer.getData("application/x-section-id") || draggingSectionId;
    if (!draggedId || draggedId === section.id) return;
    event.preventDefault();
    const position =
      event.clientY <
      event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2
        ? "before"
        : "after";
    const ordered = siblings.filter((item) => item.id !== draggedId);
    /** Remove the dragged section first, then find its neighbors in the final order. */
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
    mobileDragRef.current = { id: task.id };
    setDraggingTaskId(task.id);
    setActiveDragTarget(null);
    setActiveDropZone(null);
  };
  const moveMobileDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = mobileDragRef.current;
    if (drag === null) return;
    event.preventDefault();
    /** Match the pointer coordinates to the task, section, or project beneath them. */
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
          /** The top and bottom thirds indicate reordering; the middle indicates nesting. */
          const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
          const placement = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside";
          setActiveDragTarget({ taskId: targetTask.id, placement });
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
    /** Clear the ref immediately so another pointer event cannot apply the same move twice. */
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
          /** Recompute the position on pointerup because the last pointermove may not have fired. */
          const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
          const placement = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside";
          const nextPlacement =
            /** A center drop nests the task; edge drops use the shared domain logic. */
            placement === "inside"
              ? {
                  parentId: targetTask.id,
                  projectId: targetTask.projectId,
                  sectionId: targetTask.sectionId,
                  beforeId: null,
                  afterId: null,
                }
              : computeDropPlacement(flatTasks, moved, targetTask, placement);
          if (nextPlacement !== null) moveMutation.mutate({ taskId: moved.id, ...nextPlacement });
        }
      } else if (moved !== null && destinationSection !== null) {
        moveMutation.mutate({
          taskId: moved.id,
          projectId: moved.projectId,
          sectionId: destinationSection.dataset.mobileDropSection ?? null,
          parentId: null,
          beforeId: null,
          afterId: null,
        });
      } else if (moved !== null && destinationProject !== null) {
        const projectId =
          destinationProject.dataset.mobileDropProject === "inbox"
            ? null
            : (destinationProject.dataset.mobileDropProject ?? null);
        moveMutation.mutate({
          taskId: moved.id,
          projectId,
          sectionId: null,
          parentId: null,
          beforeId: null,
          afterId: null,
        });
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
    /** Support both regular dragging and dragging from the calendar on touch devices. */
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
        /** When dragging a selected group, move its roots to the target list. */
        const taskIds = JSON.parse(taskIdsJson) as Array<TaskId>;
        selectedMoveMutation.mutate({ taskIds, projectId: target.projectId, sectionId: target.sectionId });
        return;
      } catch {
        /** For malformed data, fall back to the existing single-task drop handling. */
      }
    }
    const moved = findTaskNode(allTasks, taskId);

    if (moved === null || hasDescendant(moved, target.id)) {
      setDraggingTaskId(null);
      setActiveDragTarget(null);
      return;
    }

    const placement = dragPlacementFromEvent(event);
    /** Allow outdenting by dropping a nested task onto itself. */
    const nextPlacement =
      placement === "outdent" || (moved.id === target.id && moved.parentId !== null)
        ? computeOutdentPlacement(flatTasks, moved)
        : moved.id === target.id
          ? null
          : placement === "inside"
            ? {
                parentId: target.id,
                projectId: target.projectId,
                sectionId: target.sectionId,
                beforeId: null,
                afterId: null,
              }
            : computeDropPlacement(flatTasks, moved, target, placement);

    if (nextPlacement !== null) {
      moveMutation.mutate({ taskId, ...nextPlacement });
      return;
    }

    setDraggingTaskId(null);
    setActiveDragTarget(null);
  };

  const markDragTarget = (task: TaskNode) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setActiveDragTarget({ taskId: task.id, placement: dragPlacementFromEvent(event) });
  };

  const moveByPlacement = (task: TaskNode, placement: ReturnType<typeof computeIndentPlacement>) => {
    if (placement !== null) {
      moveMutation.mutate({ taskId: task.id, ...placement });
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

  return {
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
  };
};
