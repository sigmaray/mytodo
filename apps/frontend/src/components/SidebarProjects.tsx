import type { Project, ProjectId } from "@todoist-clone/domain";
import clsx from "clsx";
import { Archive, Copy, Edit3, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { DragEvent } from "react";
import type { ApplicationApi } from "../api";
import { projectDepth } from "../projectTree";
import type { useSidebarProjectManagement } from "./useSidebarProjectManagement";

/**
 * Состояние и обработчики, предоставляемые хуком управления проектами.
 *
 * @typedef {ReturnType<typeof useSidebarProjectManagement>} ProjectManagement
 */
type ProjectManagement = ReturnType<typeof useSidebarProjectManagement>;

/**
 * @callback SidebarProjectsPropsIsProjectDropActive
 * @param {ProjectId | null} projectId
 * @returns {boolean}
 */

/**
 * @callback SidebarProjectsPropsOnProjectDragEnter
 * @param {ProjectId} projectId
 * @returns {DragEventHandler<HTMLElement>}
 */

/**
 * @callback SidebarProjectsPropsOnProjectDragOver
 * @param {ProjectId} projectId
 * @returns {DragEventHandler<HTMLElement>}
 */

/**
 * @callback SidebarProjectsPropsOnProjectDragLeave
 * @param {ProjectId} projectId
 * @returns {DragEventHandler<HTMLElement>}
 */

/**
 * @callback SidebarProjectsPropsOnProjectDrop
 * @param {ProjectId} projectId
 * @returns {DragEventHandler<HTMLElement>}
 */
/**
 * Данные, обработчики навигации и меню списка проектов.
 *
 * @typedef {Object} SidebarProjectsProps
 * @property {ApplicationApi | null} api - Набор API-операций для серверных данных.
 * @property {Array<Project>} navigationProjects - Проекты, отображаемые в боковой панели.
 * @property {Array<Project>} activeProjects - Активные проекты пользователя.
 * @property {ProjectId | null} selectedProjectId - Данные «выбранные проект id», используемые типом «SidebarProjectsProps».
 * @property {string} activePage - Текущая страница приложения.
 * @property {boolean} projectArchivingEnabled - Разрешено ли архивирование проектов.
 * @property {SidebarProjectsPropsIsProjectDropActive} [isProjectDropActive] - Признак, что проект является активной целью перетаскивания.
 * @property {SidebarProjectsPropsOnProjectDragEnter} [onProjectDragEnter] - Обрабатывает наведение при перетаскивании проекта.
 * @property {SidebarProjectsPropsOnProjectDragOver} [onProjectDragOver] - Обновляет целевую область проекта при перетаскивании.
 * @property {SidebarProjectsPropsOnProjectDragLeave} [onProjectDragLeave] - Сбрасывает состояние наведения проекта.
 * @property {SidebarProjectsPropsOnProjectDrop} [onProjectDrop] - Обрабатывает сброс проекта.
 * @property {ProjectManagement} management - Обработчики управления проектами.
 */
type SidebarProjectsProps = {
  api: ApplicationApi | null;

  navigationProjects: Array<Project>;

  activeProjects: Array<Project>;

  selectedProjectId: ProjectId | null;

  activePage: string;

  projectArchivingEnabled: boolean;

  isProjectDropActive?: (projectId: ProjectId | null) => boolean;

  onProjectDragEnter?: (projectId: ProjectId) => DragEventHandler<HTMLElement>;

  onProjectDragOver?: (projectId: ProjectId) => DragEventHandler<HTMLElement>;

  onProjectDragLeave?: (projectId: ProjectId) => DragEventHandler<HTMLElement>;

  onProjectDrop?: (projectId: ProjectId) => DragEventHandler<HTMLElement>;

  management: ProjectManagement;
};

/**
 * Тип обработчика HTML drag event для указанного элемента.
 *
 * @typedef {(event: DragEvent<T>) => void} DragEventHandler
 * @template T
 */
type DragEventHandler<T extends HTMLElement> = (event: DragEvent<T>) => void;

/**
 * Рисует дерево проектов с меню действий, редактированием и drag-and-drop.
 *
 * @param {SidebarProjectsProps} parameter1
 * @returns Результат выполнения функции.
 */
export const SidebarProjects = ({
  api,
  navigationProjects,
  activeProjects,
  selectedProjectId,
  activePage,
  projectArchivingEnabled,
  isProjectDropActive,
  onProjectDragEnter,
  onProjectDragOver,
  onProjectDragLeave,
  onProjectDrop,
  management,
}: SidebarProjectsProps) => {
  const {
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
    projectCreateInputRef,
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
    goToProject,
  } = management;
  return (
    <>
      <div className="sidebar-group">
        <h2>My Projects</h2>
        {navigationProjects.map((project) =>
          editProjectId === project.id ? (
            <form
              key={project.id}
              className="project-edit-form"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditProjectId(null);
                  setEditProjectTitle("");
                }
              }}
              onSubmit={(event) => void editProject(project, event)}
            >
              <label htmlFor={`project-edit-${project.id}`}>Project title</label>
              <input
                id={`project-edit-${project.id}`}
                autoFocus
                value={editProjectTitle}
                onChange={(event) => setEditProjectTitle(event.target.value)}
              />
              <button type="submit">Save project</button>
              <button
                type="button"
                onClick={() => {
                  setEditProjectId(null);
                  setEditProjectTitle("");
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div
              key={project.id}
              data-project-id={project.id}
              data-mobile-drop-project={project.id}
              style={{ paddingInlineStart: `${Math.min(projectDepth(activeProjects, project), 8) * 18}px` }}
              className={clsx(
                "project-nav-row",
                draggingProjectId === project.id && "project-dragging",
                activeProjectDrop?.id === project.id && `project-drop-${activeProjectDrop.position}`,
              )}
              draggable
              onDragStart={(event) => {
                /** HTML drag сохраняет ID проекта в payload, чтобы drop работал и за пределами sidebar. */
                draggedProjectRef.current = project.id;
                setDraggingProjectId(project.id);
                setActiveProjectDrop(null);
                event.dataTransfer.setData("application/x-project-id", project.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={cancelProjectDrag}
              onDragOver={markProjectDrop(project)}
              onDragLeave={(event) => {
                /** Переход между дочерними узлами строки не считается выходом из drop-цели. */
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setActiveProjectDrop(null);
              }}
              onDrop={dropProject(project)}
            >
              <button
                type="button"
                className="mobile-project-drag-handle"
                aria-label={`Drag project ${project.title}`}
                onPointerDown={beginProjectDrag(project)}
                onPointerMove={moveProjectDrag}
                onPointerUp={finishProjectDrag}
                onPointerCancel={cancelProjectDrag}
              >
                <GripVertical size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={clsx(
                  "nav-button",
                  activePage === "tasks" && selectedProjectId === project.id && "active",
                  isProjectDropActive?.(project.id) && "drop-active",
                )}
                title={project.title}
                onClick={() => goToProject(project.id)}
                onDragEnter={onProjectDragEnter?.(project.id)}
                onDragOver={onProjectDragOver?.(project.id)}
                onDragLeave={onProjectDragLeave?.(project.id)}
                onDrop={onProjectDrop?.(project.id)}
              >
                {project.title}
              </button>
              <details
                className={clsx(
                  "project-menu",
                  openProjectMenuId === project.id && openProjectMenuDirection === "up" && "opens-up",
                )}
                open={openProjectMenuId === project.id}
              >
                <summary
                  aria-label={`Project menu ${project.title}`}
                  onClick={(event) => {
                    event.preventDefault();
                    if (openProjectMenuId !== project.id) {
                      const trigger = event.currentTarget.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - trigger.bottom;
                      const spaceAbove = trigger.top;
                      const estimatedMenuHeight = projectArchivingEnabled ? 220 : 184;
                      setOpenProjectMenuDirection(
                        spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? "up" : "down",
                      );
                    }
                    setOpenProjectMenuId((current) => (current === project.id ? null : project.id));
                  }}
                >
                  <MoreHorizontal size={17} aria-hidden="true" />
                </summary>
                <div className="project-menu-items">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenProjectMenuId(null);
                      setNewProjectParentId(project.id);
                      setProjectTitle("");
                      setAddingProject(true);
                    }}
                  >
                    ＋ Add subproject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenProjectMenuId(null);
                      setEditProjectId(project.id);
                      setEditProjectTitle(project.title);
                    }}
                  >
                    <Edit3 size={14} aria-hidden="true" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenProjectMenuId(null);
                      void duplicateProject(project);
                    }}
                  >
                    <Copy size={14} aria-hidden="true" /> Duplicate
                  </button>
                  {projectArchivingEnabled ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenProjectMenuId(null);
                        void archiveProject(project);
                      }}
                    >
                      <Archive size={14} aria-hidden="true" /> Archive
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setOpenProjectMenuId(null);
                      void deleteProject(project);
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Delete
                  </button>
                </div>
              </details>
            </div>
          ),
        )}
      </div>
      {api !== null ? (
        <div className="sidebar-create-block">
          {addingProject ? (
            <form
              className="inline-create-form"
              onSubmit={(event) => void createProject(event)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setAddingProject(false);
                  setProjectTitle("");
                  setNewProjectParentId(null);
                }
              }}
            >
              {newProjectParentId !== null ? (
                <p>
                  Subproject of {activeProjects.find((project) => project.id === newProjectParentId)?.title}
                </p>
              ) : null}
              <label htmlFor="project-title">Title</label>
              <input
                ref={projectCreateInputRef}
                id="project-title"
                aria-label="Project title"
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
              />
              <div>
                <button type="submit" className="btn-primary">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingProject(false);
                    setProjectTitle("");
                    setNewProjectParentId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="add-project-trigger"
              onClick={() => {
                setNewProjectParentId(null);
                setProjectTitle("");
                setAddingProject(true);
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Add project
            </button>
          )}
        </div>
      ) : null}
    </>
  );
};
