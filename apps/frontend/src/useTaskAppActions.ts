import type { QueryClient } from "@tanstack/react-query";
import type { Project, Section, TaskId, TaskNode } from "@todoist-clone/domain";
import type { FormEvent } from "react";
import { useEffect } from "react";
import type { ApplicationApi } from "./api";
import { normalizeLabels } from "./components/TaskFormFields";
import { taskQueryKey } from "./queryKeys";
import { findTaskNode, inboxPlacement, projectPlacement, taskPlacement } from "./taskAppUtils";
import { flattenTaskNodes } from "./taskTreeUtils";
import { useTaskAppMutations } from "./useTaskAppMutations";
import { createTaskAppDragActions } from "./useTaskAppDragActions";
import type { TaskAppActionsState } from "./useTaskAppState";

/** Зависимости и состояние, из которых хук собирает обработчики workspace. */
type TaskAppActionInput = {
  /** HTTP-клиент приложения. */
  api: ApplicationApi;
  /** Кэш запросов для оптимистичных обновлений и инвалидации. */
  queryClient: QueryClient;
  /** Локальное состояние форм и выбранных задач. */
  state: TaskAppActionsState;
  /** Разрешена ли загрузка файлов к комментариям. */
  attachmentsEnabled: boolean;
  /** Разрешено ли архивировать проекты. */
  projectArchivingEnabled: boolean;
  /** Последний результат запроса задач. */
  taskData: Array<TaskNode> | undefined;
  /** Последний результат запроса проектов. */
  projectData: Array<Project> | undefined;
  /** Последний результат запроса секций. */
  sectionData: Array<Section> | undefined;
  /** Настройки пользователя, которые влияют на подтверждение удаления. */
  settings: { confirmDelete: boolean } | undefined;
};

/** Создаёт пользовательские обработчики и связывает их с доменными мутациями. */
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
  } = state;

  const mutations = useTaskAppMutations({ api, queryClient, state, sectionData, settings });
  const {
    confirmDeletion,
    createSubtaskMutation,
    updateProjectMutation,
    createSectionMutation,
    updateSectionMutation,
    requestSectionDelete,
    toggleMutation,
    editMutation,
    requestTaskDelete,
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
      updateSectionMutation.mutate({ id: section.id, title: trimmed });
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
      createSubtaskMutation.mutate({ title: trimmed, parent: task });
    }
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

  const allTasks = taskData ?? [];
  const flatTasks = flattenTaskNodes(allTasks);
  const scopeRootTasks = allTasks.filter(
    (task) => task.parentId === null && task.projectId === targetProjectId,
  );
  const selectedRootTasks = scopeRootTasks.filter((task) => selectedRootTaskIds.includes(task.id));
  // Групповое перемещение корня включает и все его дочерние задачи.
  const collectSelectedTaskIds = (task: TaskNode): Array<TaskId> => [
    task.id,
    ...task.children.flatMap(collectSelectedTaskIds),
  ];
  const selectedTaskIds = selectedRootTasks.flatMap(collectSelectedTaskIds);
  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedRootTaskIds([]);
    setSelectedMoveOpen(false);
  };
  const rootTaskForSelection = (task: TaskNode): TaskNode => {
    // Выбор всегда хранит только корневые задачи, даже если клик пришёлся на потомка.
    if (task.parentId === null) return task;
    const parent = findTaskNode(allTasks, task.parentId);
    return parent === null ? task : rootTaskForSelection(parent);
  };
  const toggleTaskSelection = (task: TaskNode) => {
    // В режиме выбора разрешены только задачи текущего Inbox/project scope.
    if (!selectionMode) return;
    const rootTask = rootTaskForSelection(task);
    if (!scopeRootTasks.some((candidate) => candidate.id === rootTask.id)) return;
    setSelectedRootTaskIds((current) =>
      current.includes(rootTask.id) ? current.filter((id) => id !== rootTask.id) : [...current, rootTask.id],
    );
  };
  const availableLabels = normalizeLabels(flatTasks.flatMap((task) => task.labels));
  useEffect(() => {
    // Quick-add URL открывает форму в текущем списке и очищает одноразовый параметр.
    if (new URLSearchParams(window.location.search).get("addTask") === "1") {
      setAddTaskPlacement(targetProjectId === null ? inboxPlacement : projectPlacement(targetProjectId));
      setAddTaskOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    // Ссылка на задачу открывает её детали после того, как дерево задач загружено.
    const taskId = new URLSearchParams(window.location.search).get("task");
    const task = taskId === null ? null : findTaskNode(allTasks, taskId);
    if (task !== null) {
      openDetails(task);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [allTasks, targetProjectId]);
  const allProjects = projectData ?? [];
  const activeProjects = allProjects.filter((project) => !projectArchivingEnabled || !project.archived);
  const allSections = sectionData ?? [];
  const dragActions = createTaskAppDragActions({
    api,
    queryClient,
    state,
    mutations,
    allTasks,
    flatTasks,
    allSections,
  });
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
      // Обновляем узел на месте в дереве, сохраняя уже загруженные дочерние узлы.
      queryClient.setQueryData<Array<TaskNode>>(taskQueryKey, (current) => {
        if (current === undefined) return current;
        const updateNode = (node: TaskNode): TaskNode =>
          node.id === updatedTask.id
            ? { ...node, ...updatedTask, children: node.children }
            : { ...node, children: node.children.map(updateNode) };
        return current.map(updateNode);
      });
      setDetailSaveStatus("Saved");
      return true;
    } catch {
      // Старое значение остаётся в кэше; статус сообщает пользователю о неудачной записи.
      setDetailSaveStatus("Could not save changes");
      return false;
    }
  };
  const removeCommentAttachment = async (commentId: string, attachmentId: string) => {
    if (selectedDetailsTask === null || !attachmentsEnabled) return;
    // Удаляем пустой комментарий целиком, если в нём не осталось текста и вложений.
    const comments = selectedDetailsTask.comments.flatMap((comment) => {
      if (comment.id !== commentId) return [comment];
      const attachments = (comment.attachments ?? []).filter((attachment) => attachment.id !== attachmentId);
      if (!comment.body.trim() && attachments.length === 0) return [];
      return [{ ...comment, attachments: attachments }];
    });
    const commentWasRemoved = !comments.some((comment) => comment.id === commentId);
    if ((await saveTaskDetails({ comments })) && commentWasRemoved)
      setEditingCommentId((current) => (current === commentId ? null : current));
  };
  const closeMobileLabels = async () => {
    if (selectedDetailsTask === null) return;
    if (selectedDetailsTask.labels.length > 0 && !window.confirm("Remove all saved labels from this task?"))
      return;
    // Сначала закрываем секцию и очищаем черновик, затем сохраняем удаление меток.
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
    // Подтверждение выше защищает уже сохранённые комментарии от случайного удаления.
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
    // Каждое удаление корневой подзадачи каскадно удаляет и её потомков на сервере.
    await Promise.all(selectedDetailsTask.children.map((child) => api.deleteTask(child.id)));
    if (selectedDetailsTask.children.length > 0)
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
  };
  return {
    confirmDeletion,
    updateProjectMutation,
    requestSectionDelete,
    toggleMutation,
    requestTaskDelete,
    selectedMoveMutation,
    selectedDeleteMutation,
    ...dragActions,
    submitSection,
    cancelSectionCreate,
    submitSectionEdit,
    startSectionEdit,
    startSubtask,
    submitSubtask,
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
  };
};
