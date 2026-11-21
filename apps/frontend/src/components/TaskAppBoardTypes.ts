import type { ProjectId, Section, SectionId, TaskNode } from "@todoist-clone/domain";
import type { DragEvent, FormEvent, RefObject } from "react";
import type { renderTaskNodes } from "./TaskTreeView";

/**
 * Section and side where the user intends to move it.
 *
 * @typedef {Object} ActiveSectionDrop
 * @property {SectionId} id - ID of the section being moved.
 * @property {"before" | "after"} position - Whether to place it before or after the target.
 */
type ActiveSectionDrop = {
  id: SectionId;

  position: "before" | "after";
};

/**
 * Data and handler contract for the shared Inbox and Projects board.
 *
 * @typedef {Object} TaskAppBoardProps
 * @property {ProjectId | null} targetProjectId - Target project, or `null` for the Inbox.
 * @property {React.ReactNode} scopeDescriptionBlock - Description block for the current scope.
 * @property {string | null} activeDropZone - ID of the currently highlighted drop zone.
 * @property clearDropZone - Clears the current drop zone.
 * @property markDropZone - Highlights a drop zone.
 * @property moveDroppedTask - Moves a task to the selected drop zone.
 * @property {Array<TaskNode>} inboxRootTasks - Top-level tasks in the Inbox.
 * @property {Array<TaskNode>} projectRootTasks - Top-level tasks in the project.
 * @property openAddTaskDialog - Opens the task creation dialog.
 * @property {boolean} addingSection - Whether a section is being created.
 * @property setAddingSection - Updates the section creation state.
 * @property submitSection - Saves the new section.
 * @property cancelSectionCreate - Cancels section creation.
 * @property {string} sectionTitle - Title entered for the new section.
 * @property setSectionTitle - Updates the section title.
 * @property {RefObject<HTMLInputElement | null>} sectionCreateInputRef - Reference to the section creation input.
 * @property {Array<Section>} inboxSections - Sections in the Inbox.
 * @property {Array<Section>} projectSections - Sections in the project.
 * @property {Array<TaskNode>} allTasks - All user tasks, including nested tasks.
 * @property {SectionId | null} draggingSectionId - ID of the section being dragged.
 * @property setDraggingSectionId - Updates the dragged section ID.
 * @property {ActiveSectionDrop | null} activeSectionDrop - Current section drop target.
 * @property setActiveSectionDrop - Updates the active section drop target.
 * @property {SectionId | null} editSectionId - ID of the section being edited.
 * @property setEditSectionId - Updates the section being edited.
 * @property {string} editSectionTitle - Draft title of the section being edited.
 * @property setEditSectionTitle - Updates the section title draft.
 * @property startSectionDrag - Starts dragging a section.
 * @property markSectionDrop - Marks a section drop target.
 * @property dropSection - Drops the section at the selected position.
 * @property submitSectionEdit - Saves the edited section title.
 * @property requestSectionDelete - Requests deletion of a section.
 * @property startSectionEdit - Opens the section editor.
 * @property {Parameters<typeof renderTaskNodes>[1]} taskActions - Actions available for task nodes.
 * @property {string} taskTargetLabel - Label for the selected task destination.
 */
export type TaskAppBoardProps = {
  targetProjectId: ProjectId | null;

  scopeDescriptionBlock: React.ReactNode;

  activeDropZone: string | null;

  clearDropZone: () => void;

  markDropZone: (
    /** Destination project, or the Inbox. */
    projectId: ProjectId | null,
    /** Destination section, or the list root. */
    sectionId: SectionId | null,
  ) => (event: DragEvent<HTMLElement>) => void;

  moveDroppedTask: (
    /** Destination project, or the Inbox. */
    projectId: ProjectId | null,
    /** Destination section, or the list root. */
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
