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

/**
 * Dependencies and state used by the hook to build workspace handlers.
 *
 * @typedef {Object} TaskAppActionInput
 * @property {ApplicationApi} api - API operations for server data.
 * @property {QueryClient} queryClient - Cache client for server queries.
 * @property {TaskAppActionsState} state - Current workspace data.
 * @property {boolean} attachmentsEnabled - Whether attachments can be used.
 * @property {boolean} projectArchivingEnabled - Whether projects can be archived.
 * @property {Array<TaskNode> | undefined} taskData - Tasks returned by the server query.
 * @property {Array<Project> | undefined} projectData - Projects returned by the server query.
 * @property {Array<Section> | undefined} sectionData - Sections returned by the server query.
 * @property {{ confirmDelete: boolean } | undefined} settings - User settings.
 * @property {boolean} settings.confirmDelete - Whether deletion requires confirmation.
 */
type TaskAppActionInput = {
  api: ApplicationApi;

  queryClient: QueryClient;

  state: TaskAppActionsState;

  attachmentsEnabled: boolean;

  projectArchivingEnabled: boolean;

  taskData: Array<TaskNode> | undefined;

  projectData: Array<Project> | undefined;

  sectionData: Array<Section> | undefined;

  settings: { confirmDelete: boolean } | undefined;
};

/**
 * Creates user-facing handlers and connects them to domain mutations.
 *
 * @param {TaskAppActionInput} parameter1
 * @returns Workspace action handlers.
 */
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
  /**
   * Bulk-moving a root task also moves all of its descendants.
   *
   * @param {TaskNode} task
   * @returns {Array<TaskId>}
   */
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
    /** Store only root tasks in the selection, even when a descendant was clicked. */
    if (task.parentId === null) return task;
    const parent = findTaskNode(allTasks, task.parentId);
    return parent === null ? task : rootTaskForSelection(parent);
  };
  const toggleTaskSelection = (task: TaskNode) => {
    /** In selection mode, allow only tasks from the current Inbox or project scope. */
    if (!selectionMode) return;
    const rootTask = rootTaskForSelection(task);
    if (!scopeRootTasks.some((candidate) => candidate.id === rootTask.id)) return;
    setSelectedRootTaskIds((current) =>
      current.includes(rootTask.id) ? current.filter((id) => id !== rootTask.id) : [...current, rootTask.id],
    );
  };
  const availableLabels = normalizeLabels(flatTasks.flatMap((task) => task.labels));
  useEffect(() => {
    /** A quick-add URL opens the form in the current list and clears its one-time parameter. */
    if (new URLSearchParams(window.location.search).get("addTask") === "1") {
      setAddTaskPlacement(targetProjectId === null ? inboxPlacement : projectPlacement(targetProjectId));
      setAddTaskOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    /** Open task details from a link after the task tree has loaded. */
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
      /** Update the node in place while preserving its already-loaded child nodes. */
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
      /** Keep the old value in the cache and show a status when saving fails. */
      setDetailSaveStatus("Could not save changes");
      return false;
    }
  };
  const removeCommentAttachment = async (commentId: string, attachmentId: string) => {
    if (selectedDetailsTask === null || !attachmentsEnabled) return;
    /** Remove an empty comment if it has no text or attachments left. */
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
    /** Close the section and clear the draft before saving the label removal. */
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
    /** The confirmation above protects saved comments from accidental deletion. */
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
    /** Deleting a root subtask also cascades to its descendants on the server. */
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
