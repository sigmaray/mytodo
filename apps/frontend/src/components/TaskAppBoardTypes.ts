import type { ProjectId, Section, SectionId, TaskNode } from "@todoist-clone/domain";
import type { DragEvent, FormEvent, RefObject } from "react";
import type { renderTaskNodes } from "./TaskTreeView";

type ActiveSectionDrop = Readonly<{ id: SectionId; position: "before" | "after" }>;

export type TaskAppBoardProps = Readonly<{
  targetProjectId: ProjectId | null;
  scopeDescriptionBlock: React.ReactNode;
  activeDropZone: string | null;
  clearDropZone: () => void;
  markDropZone: (
    projectId: ProjectId | null,
    sectionId: SectionId | null,
  ) => (event: DragEvent<HTMLElement>) => void;
  moveDroppedTask: (
    projectId: ProjectId | null,
    sectionId: SectionId | null,
  ) => (event: DragEvent<HTMLElement>) => void;
  inboxRootTasks: ReadonlyArray<TaskNode>;
  projectRootTasks: ReadonlyArray<TaskNode>;
  openAddTaskDialog: (placement: string, beforeId?: string | null) => void;
  addingSection: boolean;
  setAddingSection: (adding: boolean) => void;
  submitSection: (event: FormEvent<HTMLFormElement>) => void;
  cancelSectionCreate: () => void;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  sectionCreateInputRef: RefObject<HTMLInputElement | null>;
  inboxSections: ReadonlyArray<Section>;
  projectSections: ReadonlyArray<Section>;
  allTasks: ReadonlyArray<TaskNode>;
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
  dropSection: (
    section: Section,
    siblings: ReadonlyArray<Section>,
  ) => (event: DragEvent<HTMLElement>) => void;
  submitSectionEdit: (section: Section) => (event: FormEvent<HTMLFormElement>) => void;
  requestSectionDelete: (section: Section) => void;
  startSectionEdit: (section: Section) => void;
  taskActions: Parameters<typeof renderTaskNodes>[1];
  taskTargetLabel: string;
}>;
