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

/**
 * Computes the combined property type for multiple state object groups.
 *
 * @typedef {(T extends unknown ? (value: T) => void : never) extends (value: infer M) => void ? M : never} MergeGroups
 * @template T
 */
type MergeGroups<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer M) => void
  ? M
  : never;

/**
 * Combines state groups while preserving the exact type of their available properties.
 *
 * @param {...TGroups} ...groups
 */
const mergeStateGroups = <TGroups extends Array<object>>(...groups: TGroups) =>
  Object.assign({}, ...groups) as MergeGroups<TGroups[number]>;

/**
 * Composes domain-specific state hooks into contracts for workspace areas.
 *
 * @returns Composed workspace state and focused state contracts.
 */
export const useTaskAppState = () => {
  /** Return only the relevant state groups to each consumer instead of one monolithic object. */
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

/**
 * Complete state shape inferred from the composition hook.
 *
 * @typedef {ReturnType<typeof useTaskAppState>} TaskAppState
 */
export type TaskAppState = ReturnType<typeof useTaskAppState>;
/**
 * State used by the screen component.
 *
 * @typedef {TaskAppState["screen"]} TaskAppScreenState
 */
export type TaskAppScreenState = TaskAppState["screen"];
/**
 * Data and action contract for user operations.
 *
 * @typedef {TaskAppState["actions"]} TaskAppActionsState
 */
export type TaskAppActionsState = TaskAppState["actions"];
/**
 * Local state contract for mutations.
 *
 * @typedef {TaskAppState["mutations"]} TaskAppMutationsState
 */
export type TaskAppMutationsState = TaskAppState["mutations"];
/**
 * State contract for drag and drop.
 *
 * @typedef {TaskAppState["dragActions"]} TaskAppDragState
 */
export type TaskAppDragState = TaskAppState["dragActions"];
/**
 * Contract for computed display data.
 *
 * @typedef {TaskAppState["viewModel"]} TaskAppViewModelState
 */
export type TaskAppViewModelState = TaskAppState["viewModel"];
/**
 * Data and action contract used by page models.
 *
 * @typedef {TaskAppState["pageModel"]} TaskAppPageModelState
 */
export type TaskAppPageModelState = TaskAppState["pageModel"];
