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
 * Clears the highlighted drop zone.
 *
 * @callback TaskAppBoardPropsClearDropZone
 * @returns {void}
 */

/**
 * Creates a handler that highlights a target list or section during a drag.
 *
 * @callback TaskAppBoardPropsMarkDropZone
 * @param {ProjectId | null} projectId - Destination project, or the Inbox.
 * @param {SectionId | null} sectionId - Destination section, or the list root.
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Handler that completes moving a task to the selected list.
 *
 * @callback TaskAppBoardPropsMoveDroppedTask
 * @param {ProjectId | null} projectId - Destination project, or the Inbox.
 * @param {SectionId | null} sectionId - Destination section, or the list root.
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Opens the task creation form at the selected placement.
 *
 * @callback TaskAppBoardPropsOpenAddTaskDialog
 * @param {string} placement
 * @param {string | null} [beforeId]
 * @returns {void}
 */

/**
 * Changes the visibility of the section creation form.
 *
 * @callback TaskAppBoardPropsSetAddingSection
 * @param {boolean} adding
 * @returns {void}
 */

/**
 * Saves the section when the form is submitted.
 *
 * @callback TaskAppBoardPropsSubmitSection
 * @param {FormEvent<HTMLFormElement>} event
 * @returns {void}
 */

/**
 * Closes the section creation form without saving.
 *
 * @callback TaskAppBoardPropsCancelSectionCreate
 * @returns {void}
 */

/**
 * Updates the new section title field.
 *
 * @callback TaskAppBoardPropsSetSectionTitle
 * @param {string} title
 * @returns {void}
 */

/**
 * Updates the ID of the section being dragged.
 *
 * @callback TaskAppBoardPropsSetDraggingSectionId
 * @param {SectionId | null} id
 * @returns {void}
 */

/**
 * Updates the section reorder target.
 *
 * @callback TaskAppBoardPropsSetActiveSectionDrop
 * @param {ActiveSectionDrop | null} drop
 * @returns {void}
 */

/**
 * Selects a section to edit.
 *
 * @callback TaskAppBoardPropsSetEditSectionId
 * @param {SectionId | null} id
 * @returns {void}
 */

/**
 * Updates the rename form value.
 *
 * @callback TaskAppBoardPropsSetEditSectionTitle
 * @param {string} title
 * @returns {void}
 */

/**
 * Starts dragging a section.
 *
 * @callback TaskAppBoardPropsStartSectionDrag
 * @param {Section} section
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Marks a possible drop target for a section.
 *
 * @callback TaskAppBoardPropsMarkSectionDrop
 * @param {Section} section
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Completes reordering a section among its siblings.
 *
 * @callback TaskAppBoardPropsDropSection
 * @param {Section} section
 * @param {Array<Section>} siblings
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * Saves the edited section title.
 *
 * @callback TaskAppBoardPropsSubmitSectionEdit
 * @param {Section} section
 * @returns {(event: FormEvent<HTMLFormElement>) => void}
 */

/**
 * Requests section deletion according to the user's settings.
 *
 * @callback TaskAppBoardPropsRequestSectionDelete
 * @param {Section} section
 * @returns {void}
 */

/**
 * Opens the rename form for the selected section.
 *
 * @callback TaskAppBoardPropsStartSectionEdit
 * @param {Section} section
 * @returns {void}
 */
/**
 * Data and handler contract for the shared Inbox and Projects board.
 *
 * @typedef {Object} TaskAppBoardProps
 * @property {ProjectId | null} targetProjectId - Target project, or `null` for the Inbox.
 * @property {React.ReactNode} scopeDescriptionBlock - Description block for the current scope.
 * @property {string | null} activeDropZone - ID of the currently highlighted drop zone.
 * @property {TaskAppBoardPropsClearDropZone} clearDropZone - Clears the current drop zone.
 * @property {TaskAppBoardPropsMarkDropZone} markDropZone - Highlights a drop zone.
 * @property {TaskAppBoardPropsMoveDroppedTask} moveDroppedTask - Moves a task to the selected drop zone.
 * @property {Array<TaskNode>} inboxRootTasks - Top-level tasks in the Inbox.
 * @property {Array<TaskNode>} projectRootTasks - Top-level tasks in the project.
 * @property {TaskAppBoardPropsOpenAddTaskDialog} openAddTaskDialog - Opens the task creation dialog.
 * @property {boolean} addingSection - Whether a section is being created.
 * @property {TaskAppBoardPropsSetAddingSection} setAddingSection - Updates the section creation state.
 * @property {TaskAppBoardPropsSubmitSection} submitSection - Saves the new section.
 * @property {TaskAppBoardPropsCancelSectionCreate} cancelSectionCreate - Cancels section creation.
 * @property {string} sectionTitle - Title entered for the new section.
 * @property {TaskAppBoardPropsSetSectionTitle} setSectionTitle - Updates the section title.
 * @property {RefObject<HTMLInputElement | null>} sectionCreateInputRef - Reference to the section creation input.
 * @property {Array<Section>} inboxSections - Sections in the Inbox.
 * @property {Array<Section>} projectSections - Sections in the project.
 * @property {Array<TaskNode>} allTasks - All user tasks, including nested tasks.
 * @property {SectionId | null} draggingSectionId - ID of the section being dragged.
 * @property {TaskAppBoardPropsSetDraggingSectionId} setDraggingSectionId - Updates the dragged section ID.
 * @property {ActiveSectionDrop | null} activeSectionDrop - Current section drop target.
 * @property {TaskAppBoardPropsSetActiveSectionDrop} setActiveSectionDrop - Updates the active section drop target.
 * @property {SectionId | null} editSectionId - ID of the section being edited.
 * @property {TaskAppBoardPropsSetEditSectionId} setEditSectionId - Updates the section being edited.
 * @property {string} editSectionTitle - Draft title of the section being edited.
 * @property {TaskAppBoardPropsSetEditSectionTitle} setEditSectionTitle - Updates the section title draft.
 * @property {TaskAppBoardPropsStartSectionDrag} startSectionDrag - Starts dragging a section.
 * @property {TaskAppBoardPropsMarkSectionDrop} markSectionDrop - Marks a section drop target.
 * @property {TaskAppBoardPropsDropSection} dropSection - Drops the section at the selected position.
 * @property {TaskAppBoardPropsSubmitSectionEdit} submitSectionEdit - Saves the edited section title.
 * @property {TaskAppBoardPropsRequestSectionDelete} requestSectionDelete - Requests deletion of a section.
 * @property {TaskAppBoardPropsStartSectionEdit} startSectionEdit - Opens the section editor.
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
