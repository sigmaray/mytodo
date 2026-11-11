import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { Project, ProjectId, Section, SectionId, TaskId, TaskNode } from "@todoist-clone/domain";
import type { ApplicationApi } from "./api";
import { appendById, removeById, replaceById } from "./queryData";
import { projectQueryKey, sectionQueryKey, taskQueryKey } from "./queryKeys";
import { inboxPlacement, parsePlacement, taskPlacement } from "./taskAppUtils";
import type { useTaskAppState } from "./useTaskAppState";

type TaskAppState = ReturnType<typeof useTaskAppState>;
type MoveInput = Readonly<{
  taskId: TaskId;
  projectId: ProjectId | null;
  sectionId: SectionId | null;
  parentId: TaskId | null;
  beforeId: TaskId | null;
  afterId: TaskId | null;
}>;

type TaskAppMutationInput = Readonly<{
  api: ApplicationApi;
  queryClient: QueryClient;
  state: TaskAppState;
  sectionData: ReadonlyArray<Section> | undefined;
  settings: Readonly<{ confirmDelete: boolean }> | undefined;
}>;

export const useTaskAppMutations = ({
  api,
  queryClient,
  state,
  sectionData,
  settings,
}: TaskAppMutationInput) => {
  const allSections = sectionData ?? Object.freeze([]);
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

  const confirmDeletion = (message: string) => settings?.confirmDelete === false || window.confirm(message);

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
      setSelectionMode(false);
      setSelectedRootTaskIds(Object.freeze([]));
      setSelectedMoveOpen(false);
    },
  });

  const selectedDeleteMutation = useMutation({
    mutationFn: async (taskIds: ReadonlyArray<TaskId>) =>
      Promise.all(taskIds.map((taskId) => api.deleteTask(taskId))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskQueryKey });
      setSelectionMode(false);
      setSelectedRootTaskIds(Object.freeze([]));
      setSelectedMoveOpen(false);
    },
  });

  return Object.freeze({
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
  });
};
