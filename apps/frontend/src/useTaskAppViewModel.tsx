import type { DragEndEvent } from "@dnd-kit/core";
import type { QueryClient } from "@tanstack/react-query";
import type { Task, TaskNode } from "@todoist-clone/domain";
import { Edit3, MoveRight, Plus, Trash2 } from "lucide-react";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";
import { useEffect } from "react";
import { toast } from "react-toastify";
import type { ApplicationApi } from "./api";
import { AutoGrowTextarea, buildCalendarDays, calendarMonthLabel } from "./components/TaskFormFields";
import { toLocalIsoDate } from "./dateUtils";
import { inboxDescriptionQueryKey, taskQueryKey } from "./queryKeys";
import {
  createPlacementOptions,
  currentMarkdown,
  filterTaskTree,
  inboxPlacement,
  parsePlacement,
  projectPlacement,
} from "./taskAppUtils";
import { createTaskAppExportModel } from "./taskAppExportModel";
import type { useTaskAppActions } from "./useTaskAppActions";
import type { TaskAppViewModelState } from "./useTaskAppState";

/** Запросы, состояние и действия для вычисления представления workspace. */
type TaskAppViewModelInput = {
  /** API для действий отображаемых элементов. */
  api: ApplicationApi;
  /** Кэш React Query для чтения и обновления данных. */
  queryClient: QueryClient;
  /** Состояние экранных форм и выбранного представления. */
  state: TaskAppViewModelState;
  /** Обработчики действий, создаваемые отдельным хуком. */
  actions: ReturnType<typeof useTaskAppActions>;
  /** Текущий URL для выбора модели активной страницы. */
  currentPath: string;
  /** Разрешена ли работа с вложениями. */
  attachmentsEnabled: boolean;
  /** Описание Входящих, которое может ещё загружаться. */
  inboxDescription: string | undefined;
};

/** Вычисляет данные, заголовки, доступность действий и списки для отображения. */
export const useTaskAppViewModel = ({
  api,
  queryClient,
  state,
  actions,
  currentPath,
  attachmentsEnabled,
  inboxDescription,
}: TaskAppViewModelInput) => {
  const {
    dateListFilter,
    calendarMonth,
    setAddTaskOpen,
    setAddTaskTitle,
    setAddTaskDescription,
    setAddTaskFiles,
    setAddTaskDate,
    setAddTaskLabels,
    setAddTaskLabelInput,
    setShowAddTaskDescription,
    setShowAddTaskDate,
    setShowAddTaskLabels,
    setAddTaskPlacement,
    setAddTaskBeforeId,
    subtaskTitle,
    setSubtaskTitle,
    subtaskParentId,
    setSubtaskParentId,
    draggingTaskId,
    setDraggingTaskId,
    activeDragTarget,
    setActiveDragTarget,
    setActiveDropZone,
    targetProjectId,
    setEditingProjectTitle,
    projectTitleDraft,
    setProjectTitleDraft,
    targetSectionId,
    editTaskId,
    setEditTaskId,
    editTitle,
    setEditTitle,
    editPlacement,
    setEditPlacement,
    setTaskContextMenu,
    selectionMode,
    setSelectionMode,
    setSelectedMoveOpen,
    selectedMovePlacement,
    setSelectedMovePlacement,
    editingScopeDescription,
    setEditingScopeDescription,
    scopeDescriptionDraft,
    setScopeDescriptionDraft,
  } = state;
  const {
    confirmDeletion,
    updateProjectMutation,
    toggleMutation,
    requestTaskDelete,
    selectedMoveMutation,
    selectedDeleteMutation,
    startSubtask,
    submitSubtask,
    startMobileTaskDrag,
    moveMobileDrag,
    finishMobileDrag,
    cancelMobileDrag,
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
    allProjects,
    activeProjects,
    allSections,
  } = actions;

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
      ? (inboxDescription ?? "")
      : (activeProjects.find((project) => project.id === targetProjectId)?.description ?? "");
  const startScopeDescriptionEdit = () => {
    setScopeDescriptionDraft(currentScopeDescription);
    setEditingScopeDescription(true);
  };
  const saveScopeDescription = async () => {
    // У Входящих описание хранится в настройках пользователя, а у проекта — в записи проекта.
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

  const taskActions = {
    toggleTask: toggleMutation.mutate,
    startEditing,
    openDetails,
    selectionMode,
    attachmentsEnabled,
    selectedTaskIds,
    toggleTaskSelection,
    openContextMenu: (task: TaskNode) => (event: ReactMouseEvent<HTMLElement>) => {
      // Контекстное меню доступно только в списке задач и не выходит за границы окна.
      if (pageMode !== "tasks") return;
      event.preventDefault();
      const width = 196;
      const height = 176;
      setTaskContextMenu({
        task,
        left: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
      });
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
  };

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
      // Escape снимает выделение; повтор клавиши и ввод в поля игнорируются ниже.
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
          // Фильтр дат сначала исключает задачи без срока, затем применяет выбранный диапазон.
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
  const calendarTasks = flatTasks.filter((task) => task.dueDate !== null);
  const calendarDays = buildCalendarDays(calendarMonth);
  const calendarLabel = calendarMonthLabel(calendarMonth);
  const calendarTaskCount = calendarTasks.filter((task) => task.dueDate?.startsWith(calendarMonth)).length;
  const calendarTaskLocation = (task: Task) => {
    // Для подписи места предпочитаем секцию, затем проект, иначе показываем Входящие.
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
      // Закрываем inline-редактор только после подтверждения мутации.
      await updateProjectMutation.mutateAsync({ id: selectedProject.id, title });
      setEditingProjectTitle(false);
      setProjectTitleDraft("");
    } catch {
      toast.error("Could not update project name");
    }
  };
  const taskAttachments = flatTasks.flatMap((task) =>
    task.comments.flatMap((comment) =>
      (comment.attachments ?? []).map((attachment) => ({
        ...attachment,
        taskId: task.id,
        taskTitle: task.title,
        uploadedAt: comment.createdAt,
      })),
    ),
  );
  const markdown = currentMarkdown(taskTargetLabel, inboxRootTasks, allSections, allTasks, targetProjectId);
  const openAddTaskDialog = (placement: string, beforeId: string | null = null) => {
    // Каждый новый диалог начинается с чистого черновика, не наследуя прошлый ввод.
    setAddTaskPlacement(placement);
    setAddTaskBeforeId(beforeId);
    setAddTaskTitle("");
    setAddTaskDescription("");
    setAddTaskFiles([]);
    setAddTaskDate("");
    setAddTaskLabels([]);
    setAddTaskLabelInput("");
    setShowAddTaskDescription(false);
    setShowAddTaskDate(false);
    setShowAddTaskLabels(false);
    setAddTaskOpen(true);
  };
  const deleteAllTasks = async () => {
    // Удаляем только корни текущего проекта/Входящих: сервер каскадно обработает потомков.
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
    selectedDeleteMutation.mutate(selectedRootTasks.map((task) => task.id));
  };
  const moveSelectedTasks = () => {
    if (selectedRootTasks.length === 0) return;
    const placement = parsePlacement(selectedMovePlacement, allSections);
    selectedMoveMutation.mutate({ taskIds: selectedRootTasks.map((task) => task.id), ...placement });
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

  const exportModel = createTaskAppExportModel({
    allProjects,
    allSections,
    allTasks,
    flatTasks,
    targetProjectId,
    taskTargetLabel,
    inboxDescription,
  });
  return {
    inboxSections,
    projectSections,
    inboxRootTasks,
    projectRootTasks,
    scopeDescriptionBlock,
    taskActions,
    taskTargetLabel,
    pageMode,
    selectedLabel,
    viewTasks,
    calendarTasks,
    calendarDays,
    calendarLabel,
    calendarTaskCount,
    calendarTaskLocation,
    viewTitle,
    selectedProject,
    saveProjectTitle,
    taskAttachments,
    markdown,
    openAddTaskDialog,
    deleteAllTasks,
    moveSelectedTasks,
    selectionToolbar,
    finishDndDrag,
    ...exportModel,
  };
};
