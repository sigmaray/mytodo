import {
  useAddTaskState,
  useCalendarState,
  useDetailsState,
  useDragState,
  useExportsState,
  useProjectsState,
  useScopeDescriptionState,
  useSectionsState,
  useSelectionState,
  useSubtasksState,
  useTaskEditingState,
} from "./taskAppStateGroups";

export type { DropZoneId } from "./taskAppStateGroups";

type MergeGroups<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer M) => void
  ? M
  : never;

const mergeStateGroups = <TGroups extends Array<object>>(...groups: TGroups) =>
  Object.assign({}, ...groups) as MergeGroups<TGroups[number]>;

export const useTaskAppState = () => {
  const calendar = useCalendarState();
  const addTask = useAddTaskState();
  const sections = useSectionsState();
  const subtasks = useSubtasksState();
  const drag = useDragState();
  const projects = useProjectsState();
  const taskEditing = useTaskEditingState();
  const exports = useExportsState();
  const selection = useSelectionState();
  const details = useDetailsState();
  const scopeDescription = useScopeDescriptionState();

  return {
    screen: mergeStateGroups(
      calendar,
      addTask,
      sections,
      subtasks,
      drag,
      projects,
      taskEditing,
      exports,
      selection,
      details,
      scopeDescription,
    ),
    actions: mergeStateGroups(
      calendar,
      addTask,
      sections,
      subtasks,
      drag,
      projects,
      taskEditing,
      details,
      selection,
    ),
    mutations: mergeStateGroups(sections, subtasks, drag, taskEditing, selection),
    dragActions: mergeStateGroups(calendar, sections, drag, selection),
    viewModel: mergeStateGroups(
      calendar,
      addTask,
      subtasks,
      drag,
      projects,
      taskEditing,
      selection,
      details,
      scopeDescription,
    ),
    pageModel: mergeStateGroups(calendar, sections, drag, projects, exports),
  };
};

export type TaskAppState = ReturnType<typeof useTaskAppState>;
export type TaskAppScreenState = TaskAppState["screen"];
export type TaskAppActionsState = TaskAppState["actions"];
export type TaskAppMutationsState = TaskAppState["mutations"];
export type TaskAppDragState = TaskAppState["dragActions"];
export type TaskAppViewModelState = TaskAppState["viewModel"];
export type TaskAppPageModelState = TaskAppState["pageModel"];
