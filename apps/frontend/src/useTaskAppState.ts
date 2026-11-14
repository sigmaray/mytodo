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
 * Вычисляет тип объединённых свойств нескольких групп объектов состояния.
 *
 * @typedef {(T extends unknown ? (value: T) => void : never) extends (value: infer M) => void ? M : never} MergeGroups
 * @template T
 */
type MergeGroups<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer M) => void
  ? M
  : never;

/**
 * Объединяет группы состояния и сохраняет точный тип их доступных свойств.
 *
 * @param {...TGroups} ...groups
 */
const mergeStateGroups = <TGroups extends Array<object>>(...groups: TGroups) =>
  Object.assign({}, ...groups) as MergeGroups<TGroups[number]>;

/**
 * Компонуёт тематические хуки состояния в контракты для частей workspace.
 *
 * @returns Результат выполнения функции.
 */
export const useTaskAppState = () => {
  /** Каждому потребителю возвращается подходящий набор групп, без общего монолитного объекта. */
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
 * Полная форма состояния, выведенная из хука-композиции.
 *
 * @typedef {ReturnType<typeof useTaskAppState>} TaskAppState
 */
export type TaskAppState = ReturnType<typeof useTaskAppState>;
/**
 * Состояние экранного компонента.
 *
 * @typedef {TaskAppState["screen"]} TaskAppScreenState
 */
export type TaskAppScreenState = TaskAppState["screen"];
/**
 * Контракт данных и действий пользовательских операций.
 *
 * @typedef {TaskAppState["actions"]} TaskAppActionsState
 */
export type TaskAppActionsState = TaskAppState["actions"];
/**
 * Контракт локального состояния мутаций.
 *
 * @typedef {TaskAppState["mutations"]} TaskAppMutationsState
 */
export type TaskAppMutationsState = TaskAppState["mutations"];
/**
 * Контракт состояния drag-and-drop.
 *
 * @typedef {TaskAppState["dragActions"]} TaskAppDragState
 */
export type TaskAppDragState = TaskAppState["dragActions"];
/**
 * Контракт вычисленных данных для отображения.
 *
 * @typedef {TaskAppState["viewModel"]} TaskAppViewModelState
 */
export type TaskAppViewModelState = TaskAppState["viewModel"];
/**
 * Контракт данных и действий, используемый моделями страниц.
 *
 * @typedef {TaskAppState["pageModel"]} TaskAppPageModelState
 */
export type TaskAppPageModelState = TaskAppState["pageModel"];
