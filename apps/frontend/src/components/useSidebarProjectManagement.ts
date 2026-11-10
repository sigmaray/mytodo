import { useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectId } from "@todoist-clone/domain";
import type { DragEvent, FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ApplicationApi } from "../api";
import { isProjectWithinTree } from "../projectTree";
import { appendById, removeById, replaceById } from "../queryData";
import { projectQueryKey, sectionQueryKey, taskQueryKey } from "../queryKeys";

type SidebarProjectManagementOptions = Readonly<{
  api: ApplicationApi | null;
  activeProjects: ReadonlyArray<Project>;
  selectedProjectId: ProjectId | null;
  confirmDelete?: boolean;
  onInboxSelect?: () => void;
  onProjectSelect?: (projectId: ProjectId) => void;
  closeSidebar: () => void;
}>;

export const useSidebarProjectManagement = ({
  api,
  activeProjects,
  selectedProjectId,
  confirmDelete,
  onInboxSelect,
  onProjectSelect,
  closeSidebar,
}: SidebarProjectManagementOptions) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draggingProjectId, setDraggingProjectId] = useState<ProjectId | null>(null);
  const [activeProjectDrop, setActiveProjectDrop] = useState<Readonly<{
    id: ProjectId;
    position: "before" | "after" | "inside";
  }> | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectParentId, setNewProjectParentId] = useState<ProjectId | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [editProjectId, setEditProjectId] = useState<ProjectId | null>(null);
  const [editProjectTitle, setEditProjectTitle] = useState("");
  const [openProjectMenuId, setOpenProjectMenuId] = useState<ProjectId | null>(null);
  const [openProjectMenuDirection, setOpenProjectMenuDirection] = useState<"up" | "down">("down");
  const draggedProjectRef = useRef<ProjectId | null>(null);
  const mobileProjectDropRef = useRef<Readonly<{
    id: ProjectId;
    position: "before" | "after" | "inside";
  }> | null>(null);
  const projectCreateInputRef = useRef<HTMLInputElement>(null);
  const goToProject = (projectId: ProjectId) => {
    closeSidebar();
    onProjectSelect?.(projectId);
    navigate(`/?project=${encodeURIComponent(projectId)}`);
  };
  const commitProjectDrop = async (
    sourceId: ProjectId,
    target: Project,
    position: "before" | "after" | "inside",
  ) => {
    const parentId = position === "inside" ? target.id : target.parentId;
    if (sourceId === target.id || isProjectWithinTree(activeProjects, parentId, sourceId) || api === null)
      return;
    try {
      if (position === "inside") await api.moveProject(sourceId, target.id);
      else {
        const siblings = activeProjects.filter(
          (item) => item.parentId === target.parentId && item.id !== sourceId,
        );
        const index = siblings.findIndex((item) => item.id === target.id);
        const beforeId = position === "before" ? target.id : (siblings[index + 1]?.id ?? null);
        const afterId = position === "before" ? (siblings[index - 1]?.id ?? null) : target.id;
        await api.moveProject(sourceId, target.parentId);
        await api.reorderProject(sourceId, beforeId, afterId);
      }
      await queryClient.invalidateQueries({ queryKey: projectQueryKey });
    } catch {
      await queryClient.invalidateQueries({ queryKey: projectQueryKey });
    }
  };
  const positionFor = (row: HTMLElement, clientY: number) => {
    const rect = row.getBoundingClientRect();
    const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    return ratio < 0.2 ? ("before" as const) : ratio > 0.8 ? ("after" as const) : ("inside" as const);
  };
  const beginProjectDrag = (project: Project) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggedProjectRef.current = project.id;
    mobileProjectDropRef.current = null;
    setDraggingProjectId(project.id);
    setActiveProjectDrop(null);
  };
  const moveProjectDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const sourceId = draggedProjectRef.current;
    if (sourceId === null) return;
    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const row =
      element instanceof Element ? element.closest<HTMLElement>(".project-nav-row[data-project-id]") : null;
    const target = activeProjects.find((project) => project.id === row?.dataset.projectId);
    if (row === null || target === undefined) {
      mobileProjectDropRef.current = null;
      setActiveProjectDrop(null);
      return;
    }
    const position = positionFor(row, event.clientY);
    const parentId = position === "inside" ? target.id : target.parentId;
    const drop =
      target.id === sourceId || isProjectWithinTree(activeProjects, parentId, sourceId)
        ? null
        : Object.freeze({ id: target.id, position });
    mobileProjectDropRef.current = drop;
    setActiveProjectDrop(drop);
  };
  const finishProjectDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const sourceId = draggedProjectRef.current;
    const rememberedDrop = mobileProjectDropRef.current;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const row =
      element instanceof Element ? element.closest<HTMLElement>(".project-nav-row[data-project-id]") : null;
    const target = activeProjects.find(
      (project) => project.id === (rememberedDrop?.id ?? row?.dataset.projectId),
    );
    const position = rememberedDrop?.position ?? (row === null ? null : positionFor(row, event.clientY));
    draggedProjectRef.current = null;
    mobileProjectDropRef.current = null;
    setDraggingProjectId(null);
    setActiveProjectDrop(null);
    if (sourceId !== null && target !== undefined && position !== null)
      void commitProjectDrop(sourceId, target, position);
  };
  const cancelProjectDrag = () => {
    draggedProjectRef.current = null;
    mobileProjectDropRef.current = null;
    setDraggingProjectId(null);
    setActiveProjectDrop(null);
  };
  const markProjectDrop = (target: Project) => (event: DragEvent<HTMLElement>) => {
    const sourceId = event.dataTransfer.getData("application/x-project-id") || draggedProjectRef.current;
    if (sourceId === null || sourceId === target.id) return;
    const position = positionFor(event.currentTarget, event.clientY);
    const parentId = position === "inside" ? target.id : target.parentId;
    if (isProjectWithinTree(activeProjects, parentId, sourceId)) {
      setActiveProjectDrop(null);
      return;
    }
    event.preventDefault();
    setActiveProjectDrop(Object.freeze({ id: target.id, position }));
  };
  const dropProject = (target: Project) => (event: DragEvent<HTMLElement>) => {
    const sourceId = event.dataTransfer.getData("application/x-project-id") || draggedProjectRef.current;
    if (sourceId === null) return;
    event.preventDefault();
    event.stopPropagation();
    const position = positionFor(event.currentTarget, event.clientY);
    setDraggingProjectId(null);
    setActiveProjectDrop(null);
    draggedProjectRef.current = null;
    void commitProjectDrop(sourceId, target, position);
  };
  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = projectTitle.trim();
    if (api === null || title.length === 0) return;
    await queryClient.cancelQueries({ queryKey: projectQueryKey });
    const created = await api.createProject(title, newProjectParentId);
    queryClient.setQueryData(projectQueryKey, (current: ReadonlyArray<Project> | undefined) =>
      appendById(current, created),
    );
    setProjectTitle("");
    setAddingProject(false);
    setNewProjectParentId(null);
    goToProject(created.id);
  };
  const editProject = async (project: Project, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = editProjectTitle.trim();
    if (api === null || title.length === 0) return;
    const updated = await api.updateProject(project.id, { title });
    queryClient.setQueryData(projectQueryKey, (current: ReadonlyArray<Project> | undefined) =>
      replaceById(current, updated),
    );
    setEditProjectId(null);
    setEditProjectTitle("");
  };
  const duplicateProject = async (project: Project) => {
    if (api === null) return;
    const duplicate = await api.duplicateProject(project.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectQueryKey }),
      queryClient.invalidateQueries({ queryKey: sectionQueryKey }),
      queryClient.invalidateQueries({ queryKey: taskQueryKey }),
    ]);
    goToProject(duplicate.id);
  };
  const archiveProject = async (project: Project) => {
    if (api === null) return;
    const archived = await api.archiveProject(project.id, true);
    queryClient.setQueryData(projectQueryKey, (current: ReadonlyArray<Project> | undefined) =>
      replaceById(current, archived),
    );
    if (selectedProjectId === project.id) onInboxSelect?.();
  };
  const deleteProject = async (project: Project) => {
    if (api === null) return;
    if (confirmDelete !== false && !window.confirm(`Delete project “${project.title}” and all its tasks?`))
      return;
    await api.deleteProject(project.id);
    queryClient.setQueryData(projectQueryKey, (current: ReadonlyArray<Project> | undefined) =>
      removeById(current, project.id),
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: sectionQueryKey }),
      queryClient.invalidateQueries({ queryKey: taskQueryKey }),
    ]);
    if (selectedProjectId === project.id) onInboxSelect?.();
  };
  return Object.freeze({
    draggingProjectId,
    activeProjectDrop,
    addingProject,
    newProjectParentId,
    projectTitle,
    editProjectId,
    editProjectTitle,
    openProjectMenuId,
    openProjectMenuDirection,
    setDraggingProjectId,
    setActiveProjectDrop,
    setAddingProject,
    setNewProjectParentId,
    setProjectTitle,
    setEditProjectId,
    setEditProjectTitle,
    setOpenProjectMenuId,
    setOpenProjectMenuDirection,
    draggedProjectRef,
    mobileProjectDropRef,
    projectCreateInputRef,
    goToProject,
    commitProjectDrop,
    positionFor,
    beginProjectDrag,
    moveProjectDrag,
    finishProjectDrag,
    cancelProjectDrag,
    markProjectDrop,
    dropProject,
    createProject,
    editProject,
    duplicateProject,
    archiveProject,
    deleteProject,
  });
};
