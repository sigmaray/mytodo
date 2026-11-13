import type { QueryClient } from "@tanstack/react-query";
import type { ProjectId, Section, SectionId, Task, TaskId, TaskNode } from "@todoist-clone/domain";
import { computeDropPlacement, computeIndentPlacement, computeOutdentPlacement } from "@todoist-clone/domain";
import type { DragEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { ApplicationApi } from "./api";
import { taskQueryKey } from "./queryKeys";
import { dragPlacementFromEvent, findTaskNode, hasDescendant, inboxPlacement } from "./taskAppUtils";
import type { useTaskAppMutations } from "./useTaskAppMutations";
import type { DropZoneId, useTaskAppState } from "./useTaskAppState";

type TaskAppDragActionInput = {
  api: ApplicationApi;
  queryClient: QueryClient;
  state: ReturnType<typeof useTaskAppState>;
  mutations: ReturnType<typeof useTaskAppMutations>;
  allTasks: Array<TaskNode>;
  flatTasks: Array<Task>;
  allSections: Array<Section>;
};

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
            const taskIds = JSON.parse(taskIdsJson) as Array<TaskId>;
            if (taskIds.length > 0) selectedMoveMutation.mutate({ taskIds, projectId, sectionId });
          } catch {
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
        const taskIds = JSON.parse(taskIdsJson) as Array<TaskId>;
        selectedMoveMutation.mutate({ taskIds, projectId: target.projectId, sectionId: target.sectionId });
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
