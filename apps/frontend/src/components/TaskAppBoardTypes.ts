import type { ProjectId, Section, SectionId, TaskNode } from "@todoist-clone/domain";
import type { DragEvent, FormEvent, RefObject } from "react";
import type { renderTaskNodes } from "./TaskTreeView";

/** Секция и сторона, куда пользователь планирует её переместить. */
type ActiveSectionDrop = {
  /** Идентификатор перемещаемой целевой секции. */
  id: SectionId;
  /** Размещение до или после цели. */
  position: "before" | "after";
};

/** Контракт данных и обработчиков общей доски Inbox/Projects. */
export type TaskAppBoardProps = {
  /** Открытый проект или `null`, если показаны Входящие. */
  targetProjectId: ProjectId | null;
  /** Блок описания текущей области задач. */
  scopeDescriptionBlock: React.ReactNode;
  /** Активная drop-zone для подсветки места назначения. */
  activeDropZone: string | null;
  /** Сбрасывает подсветку зоны назначения. */
  clearDropZone: () => void;
  /** Создаёт обработчик подсветки целевого списка или секции для перетаскивания. */
  markDropZone: (
    /** Целевой проект либо Входящие. */
    projectId: ProjectId | null,
    /** Целевая секция либо корень списка. */
    sectionId: SectionId | null,
  ) => (event: DragEvent<HTMLElement>) => void;
  /** Обработчик завершения перемещения задачи в выбранный список. */
  moveDroppedTask: (
    /** Целевой проект либо Входящие. */
    projectId: ProjectId | null,
    /** Целевая секция либо корень списка. */
    sectionId: SectionId | null,
  ) => (event: DragEvent<HTMLElement>) => void;
  /** Корневые задачи Входящих. */
  inboxRootTasks: Array<TaskNode>;
  /** Корневые задачи открытого проекта. */
  projectRootTasks: Array<TaskNode>;
  /** Открывает форму добавления задачи в выбранном месте. */
  openAddTaskDialog: (placement: string, beforeId?: string | null) => void;
  /** Показывает форму создания секции. */
  addingSection: boolean;
  /** Меняет видимость формы создания секции. */
  setAddingSection: (adding: boolean) => void;
  /** Сохраняет секцию после отправки формы. */
  submitSection: (event: FormEvent<HTMLFormElement>) => void;
  /** Закрывает форму создания секции без сохранения. */
  cancelSectionCreate: () => void;
  /** Текущее значение поля новой секции. */
  sectionTitle: string;
  /** Обновляет значение поля новой секции. */
  setSectionTitle: (title: string) => void;
  /** Ref поля, которое получает фокус при открытии формы. */
  sectionCreateInputRef: RefObject<HTMLInputElement | null>;
  /** Секции Входящих. */
  inboxSections: Array<Section>;
  /** Секции проекта. */
  projectSections: Array<Section>;
  /** Полное дерево задач для построения списков и поиска узлов. */
  allTasks: Array<TaskNode>;
  /** ID секции, которую сейчас перетаскивают. */
  draggingSectionId: SectionId | null;
  /** Обновляет ID перетаскиваемой секции. */
  setDraggingSectionId: (id: SectionId | null) => void;
  /** Текущая цель перестановки секции. */
  activeSectionDrop: ActiveSectionDrop | null;
  /** Обновляет цель перестановки секции. */
  setActiveSectionDrop: (drop: ActiveSectionDrop | null) => void;
  /** ID редактируемой секции или `null`, если редактирование закрыто. */
  editSectionId: SectionId | null;
  /** Выбирает секцию для редактирования. */
  setEditSectionId: (id: SectionId | null) => void;
  /** Значение формы переименования секции. */
  editSectionTitle: string;
  /** Обновляет значение формы переименования. */
  setEditSectionTitle: (title: string) => void;
  /** Начинает перетаскивание секции. */
  startSectionDrag: (section: Section) => (event: DragEvent<HTMLElement>) => void;
  /** Отмечает возможную цель drop для секции. */
  markSectionDrop: (section: Section) => (event: DragEvent<HTMLElement>) => void;
  /** Завершает перестановку секции среди соседей. */
  dropSection: (section: Section, siblings: Array<Section>) => (event: DragEvent<HTMLElement>) => void;
  /** Сохраняет отредактированное название секции. */
  submitSectionEdit: (section: Section) => (event: FormEvent<HTMLFormElement>) => void;
  /** Запрашивает удаление секции с учётом пользовательских настроек. */
  requestSectionDelete: (section: Section) => void;
  /** Открывает форму переименования выбранной секции. */
  startSectionEdit: (section: Section) => void;
  /** Действия, передаваемые строкам дерева задач. */
  taskActions: Parameters<typeof renderTaskNodes>[1];
  /** Заголовок текущей области для отображения пользователю. */
  taskTargetLabel: string;
};
