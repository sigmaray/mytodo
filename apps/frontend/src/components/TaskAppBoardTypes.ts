import type { ProjectId, Section, SectionId, TaskNode } from "@todoist-clone/domain";
import type { DragEvent, FormEvent, RefObject } from "react";
import type { renderTaskNodes } from "./TaskTreeView";

/**
 * Секция и сторона, куда пользователь планирует её переместить.
 *
 * @typedef {Object} ActiveSectionDrop
 * @property {SectionId} id - Идентификатор сущности, с которой работает модуль.
 * @property {"before" | "after"} position - Данные «position», используемые типом «ActiveSectionDrop».
 */
type ActiveSectionDrop = {
  id: SectionId;

  position: "before" | "after";
};

/**
 * Сбрасывает подсветку зоны назначения.
 *
 * @callback TaskAppBoardPropsClearDropZone
 * @returns {void}
 */

/**
 * Создаёт обработчик подсветки целевого списка или секции для перетаскивания.
 *
 * @callback TaskAppBoardPropsMarkDropZone
 * @param {ProjectId | null} projectId - Целевой проект либо Входящие.
 * @param {SectionId | null} sectionId - Целевая секция либо корень списка.
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Обработчик завершения перемещения задачи в выбранный список.
 *
 * @callback TaskAppBoardPropsMoveDroppedTask
 * @param {ProjectId | null} projectId - Целевой проект либо Входящие.
 * @param {SectionId | null} sectionId - Целевая секция либо корень списка.
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Открывает форму добавления задачи в выбранном месте.
 *
 * @callback TaskAppBoardPropsOpenAddTaskDialog
 * @param {string} placement
 * @param {string | null} [beforeId]
 * @returns {void}
 */

/**
 * Меняет видимость формы создания секции.
 *
 * @callback TaskAppBoardPropsSetAddingSection
 * @param {boolean} adding
 * @returns {void}
 */

/**
 * Сохраняет секцию после отправки формы.
 *
 * @callback TaskAppBoardPropsSubmitSection
 * @param {FormEvent<HTMLFormElement>} event
 * @returns {void}
 */

/**
 * Закрывает форму создания секции без сохранения.
 *
 * @callback TaskAppBoardPropsCancelSectionCreate
 * @returns {void}
 */

/**
 * Обновляет значение поля новой секции.
 *
 * @callback TaskAppBoardPropsSetSectionTitle
 * @param {string} title
 * @returns {void}
 */

/**
 * Обновляет ID перетаскиваемой секции.
 *
 * @callback TaskAppBoardPropsSetDraggingSectionId
 * @param {SectionId | null} id
 * @returns {void}
 */

/**
 * Обновляет цель перестановки секции.
 *
 * @callback TaskAppBoardPropsSetActiveSectionDrop
 * @param {ActiveSectionDrop | null} drop
 * @returns {void}
 */

/**
 * Выбирает секцию для редактирования.
 *
 * @callback TaskAppBoardPropsSetEditSectionId
 * @param {SectionId | null} id
 * @returns {void}
 */

/**
 * Обновляет значение формы переименования.
 *
 * @callback TaskAppBoardPropsSetEditSectionTitle
 * @param {string} title
 * @returns {void}
 */

/**
 * Начинает перетаскивание секции.
 *
 * @callback TaskAppBoardPropsStartSectionDrag
 * @param {Section} section
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Отмечает возможную цель drop для секции.
 *
 * @callback TaskAppBoardPropsMarkSectionDrop
 * @param {Section} section
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Завершает перестановку секции среди соседей.
 *
 * @callback TaskAppBoardPropsDropSection
 * @param {Section} section
 * @param {Array<Section>} siblings
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Сохраняет отредактированное название секции.
 *
 * @callback TaskAppBoardPropsSubmitSectionEdit
 * @param {Section} section
 * @returns {(event: FormEvent<HTMLFormElement>) => void}
 */

/**
 * Запрашивает удаление секции с учётом пользовательских настроек.
 *
 * @callback TaskAppBoardPropsRequestSectionDelete
 * @param {Section} section
 * @returns {void}
 */

/**
 * Открывает форму переименования выбранной секции.
 *
 * @callback TaskAppBoardPropsStartSectionEdit
 * @param {Section} section
 * @returns {void}
 */
/**
 * Контракт данных и обработчиков общей доски Inbox/Projects.
 *
 * @typedef {Object} TaskAppBoardProps
 * @property {ProjectId | null} targetProjectId - Данные «target проект id», используемые типом «TaskAppBoardProps».
 * @property {React.ReactNode} scopeDescriptionBlock - Данные «область описание block», используемые типом «TaskAppBoardProps».
 * @property {string | null} activeDropZone - Данные «активные удаление zone», используемые типом «TaskAppBoardProps».
 * @property {TaskAppBoardPropsClearDropZone} clearDropZone - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsMarkDropZone} markDropZone - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsMoveDroppedTask} moveDroppedTask - Вызывает соответствующую операцию API.
 * @property {Array<TaskNode>} inboxRootTasks - Список задач, относящихся к Входящие корневые.
 * @property {Array<TaskNode>} projectRootTasks - Список задач, относящихся к проект корневые.
 * @property {TaskAppBoardPropsOpenAddTaskDialog} openAddTaskDialog - Вызывает соответствующую операцию API.
 * @property {boolean} addingSection - Признак или настройка «adding секция».
 * @property {TaskAppBoardPropsSetAddingSection} setAddingSection - Обновляет значение соответствующего состояния.
 * @property {TaskAppBoardPropsSubmitSection} submitSection - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsCancelSectionCreate} cancelSectionCreate - Признак: cancel секция создание.
 * @property {string} sectionTitle - Данные «секция заголовок», используемые типом «TaskAppBoardProps».
 * @property {TaskAppBoardPropsSetSectionTitle} setSectionTitle - Обновляет значение соответствующего состояния.
 * @property {RefObject<HTMLInputElement | null>} sectionCreateInputRef - Данные «секция создание ввод ссылка», используемые типом «TaskAppBoardProps».
 * @property {Array<Section>} inboxSections - Список секций для Входящие.
 * @property {Array<Section>} projectSections - Список секций для проект.
 * @property {Array<TaskNode>} allTasks - Все задачи пользователя, включая вложенные.
 * @property {SectionId | null} draggingSectionId - Данные «dragging секция id», используемые типом «TaskAppBoardProps».
 * @property {TaskAppBoardPropsSetDraggingSectionId} setDraggingSectionId - Обновляет значение соответствующего состояния.
 * @property {ActiveSectionDrop | null} activeSectionDrop - Данные «активные секция удаление», используемые типом «TaskAppBoardProps».
 * @property {TaskAppBoardPropsSetActiveSectionDrop} setActiveSectionDrop - Обновляет значение соответствующего состояния.
 * @property {SectionId | null} editSectionId - Данные «редактирование секция id», используемые типом «TaskAppBoardProps».
 * @property {TaskAppBoardPropsSetEditSectionId} setEditSectionId - Обновляет значение соответствующего состояния.
 * @property {string} editSectionTitle - Черновик названия редактируемой секции.
 * @property {TaskAppBoardPropsSetEditSectionTitle} setEditSectionTitle - Обновляет значение соответствующего состояния.
 * @property {TaskAppBoardPropsStartSectionDrag} startSectionDrag - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsMarkSectionDrop} markSectionDrop - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsDropSection} dropSection - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsSubmitSectionEdit} submitSectionEdit - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsRequestSectionDelete} requestSectionDelete - Вызывает соответствующую операцию API.
 * @property {TaskAppBoardPropsStartSectionEdit} startSectionEdit - Вызывает соответствующую операцию API.
 * @property {Parameters<typeof renderTaskNodes>[1]} taskActions - Данные «задача действия», используемые типом «TaskAppBoardProps».
 * @property {string} taskTargetLabel - Название выбранной области назначения задачи.
 */
export type TaskAppBoardProps = {
  targetProjectId: ProjectId | null;

  scopeDescriptionBlock: React.ReactNode;

  activeDropZone: string | null;

  clearDropZone: () => void;

  markDropZone: (
    /** Целевой проект либо Входящие. */
    projectId: ProjectId | null,
    /** Целевая секция либо корень списка. */
    sectionId: SectionId | null,
  ) => (event: DragEvent<HTMLElement>) => void;

  moveDroppedTask: (
    /** Целевой проект либо Входящие. */
    projectId: ProjectId | null,
    /** Целевая секция либо корень списка. */
    sectionId: SectionId | null,
  ) => (event: DragEvent<HTMLElement>) => void;

  inboxRootTasks: Array<TaskNode>;

  projectRootTasks: Array<TaskNode>;

  openAddTaskDialog: (placement: string, beforeId?: string | null) => void;

  addingSection: boolean;

  setAddingSection: (adding: boolean) => void;

  submitSection: (event: FormEvent<HTMLFormElement>) => void;

  cancelSectionCreate: () => void;

  sectionTitle: string;

  setSectionTitle: (title: string) => void;

  sectionCreateInputRef: RefObject<HTMLInputElement | null>;

  inboxSections: Array<Section>;

  projectSections: Array<Section>;

  allTasks: Array<TaskNode>;

  draggingSectionId: SectionId | null;

  setDraggingSectionId: (id: SectionId | null) => void;

  activeSectionDrop: ActiveSectionDrop | null;

  setActiveSectionDrop: (drop: ActiveSectionDrop | null) => void;

  editSectionId: SectionId | null;

  setEditSectionId: (id: SectionId | null) => void;

  editSectionTitle: string;

  setEditSectionTitle: (title: string) => void;

  startSectionDrag: (section: Section) => (event: DragEvent<HTMLElement>) => void;

  markSectionDrop: (section: Section) => (event: DragEvent<HTMLElement>) => void;

  dropSection: (section: Section, siblings: Array<Section>) => (event: DragEvent<HTMLElement>) => void;

  submitSectionEdit: (section: Section) => (event: FormEvent<HTMLFormElement>) => void;

  requestSectionDelete: (section: Section) => void;

  startSectionEdit: (section: Section) => void;

  taskActions: Parameters<typeof renderTaskNodes>[1];

  taskTargetLabel: string;
};
