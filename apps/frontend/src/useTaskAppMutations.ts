import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { Project, ProjectId, Section, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import type { ApplicationApi } from "./api";
import { appendById, removeById, replaceById } from "./queryData";
import { projectQueryKey, sectionQueryKey, taskQueryKey } from "./queryKeys";
import { inboxPlacement, parsePlacement, taskPlacement } from "./taskAppUtils";
import type { TaskAppMutationsState } from "./useTaskAppState";

/**
 * Destination fields used to move a task through the API.
 *
 * @typedef {Object} MoveInput
 * @property {TaskId} taskId - ID of the task to move.
 * @property {ProjectId | null} projectId - Destination project ID, or `null` for the Inbox.
 * @property {SectionId | null} sectionId - Destination section ID, or `null` for the project root.
 * @property {TaskId | null} parentId - New parent task ID, or `null` for a root task.
 * @property {TaskId | null} beforeId - ID of a neighboring task to place this task before.
 * @property {TaskId | null} afterId - ID of a neighboring task to place this task after.
 */
type MoveInput = {
  taskId: TaskId;

  projectId: ProjectId | null;

  sectionId: SectionId | null;

  parentId: TaskId | null;

  beforeId: TaskId | null;

  afterId: TaskId | null;
};

/**
 * Arguments for creating the workspace React Query mutations.
 *
 * @typedef {Object} TaskAppMutationInput
 * @property {ApplicationApi} api - API operations for server data.
 * @property {QueryClient} queryClient - Cache client for server queries.
 * @property {TaskAppMutationsState} state - Current workspace data.
 * @property {Array<Section> | undefined} sectionData - Sections returned by the server query.
 * @property {{ confirmDelete: boolean } | undefined} settings - User settings.
 * @property {boolean} settings.confirmDelete - Whether deletion requires confirmation.
 */
type TaskAppMutationInput = {
  api: ApplicationApi;

  queryClient: QueryClient;

  state: TaskAppMutationsState;

  sectionData: Array<Section> | undefined;

  settings: { confirmDelete: boolean } | undefined;
};

/**
 * Creates mutations and optimistic updates for tasks, projects, and sections.
 *
 * @param {TaskAppMutationInput} parameter1
 * @returns Workspace mutations.
 */
export const useTaskAppMutations = ({
  api,
  queryClient,
  state,
  sectionData,
  settings,
}: TaskAppMutationInput) => {
  const allSections = sectionData ?? [];
  const {
    setSectionTitle,
    setAddingSection,
    setEditSectionId,
    setEditSectionTitle,
    setSubtaskTitle,
    setSubtaskParentId,
    setDraggingTaskId,
    setActiveDragTarget,
    setActiveDropZone,
    setEditTaskId,
    editTitle,
    setEditTitle,
    editPlacement,
    setEditPlacement,
    setSelectionMode,
    setSelectedRootTaskIds,
    setSelectedMoveOpen,
  } = state;

  /**
   * If the setting is missing, use the safe behavior and require confirmation.
   *
   * @param {string} message
   */
  const confirmDeletion = (message: string) => settings?.confirmDelete === false || window.confirm(message);

  const createSubtaskMutation = useMutation({
    mutationFn: (subtask: { title: string; parent: TaskNode }) =>
      api.createTask(subtask.title, subtask.parent.projectId, subtask.parent.sectionId, subtask.parent.id),
    onSuccess: async () => {
      setSubtaskTitle("");
      setSubtaskParentId(null);
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (project: { id: ProjectId; title?: string; description?: string }) =>
      api.updateProject(project.id, project),
    onSuccess: (project) => {
      queryClient.setQueryData(projectQueryKey, (current: Array<Project> | undefined) =>
        replaceById(current, project),
      );
    },
  });

  const reorderSectionMutation = useMutation({
    mutationFn: ({
      id,
      beforeId,
      afterId,
    }: {
      id: SectionId;
      beforeId: SectionId | null;
      afterId: SectionId | null;
    }) => api.reorderSection(id, beforeId, afterId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sectionQueryKey });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: (input: { title: string; projectId: ProjectId | null }) =>
      api.createSection(input.title, input.projectId),
    onSuccess: (section) => {
      setSectionTitle("");
      setAddingSection(false);
      queryClient.setQueryData(sectionQueryKey, (current: Array<Section> | undefined) =>
        appendById(current, section),
      );
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: (section: { id: SectionId; title: string }) => api.updateSection(section.id, section.title),
    onSuccess: (section) => {
      setEditSectionId(null);
      setEditSectionTitle("");
      queryClient.setQueryData(sectionQueryKey, (current: Array<Section> | undefined) =>
        replaceById(current, section),
      );
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (section: Section) => api.deleteSection(section.id).then(() => section),
    onSuccess: async (section) => {
      queryClient.setQueryData(sectionQueryKey, (current: Array<Section> | undefined) =>
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
      /** Cancel stale queries so they do not overwrite the optimistic state. */
      await queryClient.cancelQueries({ queryKey: taskQueryKey });
      const previousTasks = queryClient.getQueryData<Array<TaskNode>>(taskQueryKey);

      /**
       * Update the selected task in the tree without changing its descendants.
       *
       * @param {Array<TaskNode>} nodes
       * @returns {Array<TaskNode>}
       */
      const toggleNodes = (nodes: Array<TaskNode>): Array<TaskNode> =>
        nodes.map((node) => ({
          ...node,
          completed: node.id === task.id ? !node.completed : node.completed,
          children: toggleNodes(node.children),
        }));

      queryClient.setQueryData(taskQueryKey, toggleNodes(previousTasks ?? []));

      return { previousTasks };
    },
    onError: (_error, _task, context) => {
      /** Restore the cache snapshot if the server rejects the toggle. */
      queryClient.setQueryData(taskQueryKey, context?.previousTasks);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (task: TaskNode) => {
      /** Update the text first; move separately only when the list changes. */
      const placement = parsePlacement(editPlacement, allSections);
      const titleTask = await api.updateTask(task.id, { title: editTitle.trim() });

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
    mutationFn: async (input: {
      taskIds: Array<TaskId>;
      projectId: ProjectId | null;
      sectionId: SectionId | null;
    }) => {
      /** Sequential moves preserve predictable order and isolate failures for each item. */
      for (const taskId of input.taskIds) {
        await api.moveTask(taskId, input.projectId, input.sectionId, null, null, null);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
      setSelectionMode(false);
      setSelectedRootTaskIds([]);
      setSelectedMoveOpen(false);
    },
  });

  const selectedDeleteMutation = useMutation({
    mutationFn: async (taskIds: Array<TaskId>) =>
      /** Delete all selected roots and clear the interface state after success. */
      Promise.all(taskIds.map((taskId) => api.deleteTask(taskId))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
      setSelectionMode(false);
      setSelectedRootTaskIds([]);
      setSelectedMoveOpen(false);
    },
  });

  return {
    confirmDeletion,
    createSubtaskMutation,
    updateProjectMutation,
    reorderSectionMutation,
    createSectionMutation,
    updateSectionMutation,
    deleteSectionMutation,
    requestSectionDelete,
    toggleMutation,
    editMutation,
    deleteMutation,
    requestTaskDelete,
    moveMutation,
    selectedMoveMutation,
    selectedDeleteMutation,
  };
};
