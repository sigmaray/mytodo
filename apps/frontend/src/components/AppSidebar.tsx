import { useQuery } from "@tanstack/react-query";
import type { ProjectId, Task } from "@todoist-clone/domain";
import clsx from "clsx";
import {
  Archive,
  CalendarDays,
  Code2,
  Copy,
  Download,
  Edit3,
  GripVertical,
  Inbox,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  Settings,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { ReactElement, UIEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ApplicationApi } from "../api";
import { projectDepth, projectTreeOrder } from "../projectTree";
import {
  authStatusQueryKey,
  projectQueryKey,
  sectionQueryKey,
  settingsQueryKey,
  taskQueryKey,
} from "../queryKeys";
import { flattenTaskNodes } from "../taskTreeUtils";
import { SearchPalette } from "./SearchPalette";
import { useSidebarProjectManagement } from "./useSidebarProjectManagement";

const toolsEnabled = import.meta.env.DEV || import.meta.env.MODE === "test";

let rememberedSidebarScrollTop = 0;

const useSidebarScrollPosition = () => {
  const sidebarRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (sidebarRef.current !== null) sidebarRef.current.scrollTop = rememberedSidebarScrollTop;
  }, []);
  const rememberScroll = (event: UIEvent<HTMLElement>) => {
    rememberedSidebarScrollTop = event.currentTarget.scrollTop;
  };
  return Object.freeze({ ref: sidebarRef, onScroll: rememberScroll });
};

type AppSidebarProps = Readonly<{
  api: ApplicationApi | null;
  selectedProjectId?: ProjectId | null;
  onInboxSelect?: () => void;
  onProjectSelect?: (projectId: ProjectId) => void;
  onTaskSelect?: (task: Task) => void;
  onAddTask?: () => void;
  isProjectDropActive?: (projectId: ProjectId | null) => boolean;
  onInboxDragEnter?: React.DragEventHandler<HTMLElement>;
  onInboxDragOver?: React.DragEventHandler<HTMLElement>;
  onInboxDragLeave?: React.DragEventHandler<HTMLElement>;
  onInboxDrop?: React.DragEventHandler<HTMLElement>;
  onProjectDragEnter?: (projectId: ProjectId) => React.DragEventHandler<HTMLElement>;
  onProjectDragOver?: (projectId: ProjectId) => React.DragEventHandler<HTMLElement>;
  onProjectDragLeave?: (projectId: ProjectId) => React.DragEventHandler<HTMLElement>;
  onProjectDrop?: (projectId: ProjectId) => React.DragEventHandler<HTMLElement>;
}>;

export const AppSidebar = ({
  api,
  selectedProjectId = null,
  onInboxSelect,
  onProjectSelect,
  onTaskSelect,
  onAddTask,
  isProjectDropActive,
  onInboxDragEnter,
  onInboxDragOver,
  onInboxDragLeave,
  onInboxDrop,
  onProjectDragEnter,
  onProjectDragOver,
  onProjectDragLeave,
  onProjectDrop,
}: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarScroll = useSidebarScrollPosition();
  const authStatus = useQuery({
    queryKey: authStatusQueryKey,
    queryFn: api?.getAuthStatus ?? (async () => null),
    enabled: api !== null,
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const projectsQuery = useQuery({
    queryKey: projectQueryKey,
    queryFn: api?.listProjects ?? (async () => Object.freeze([])),
    enabled: api !== null,
  });
  const tasksQuery = useQuery({
    queryKey: taskQueryKey,
    queryFn: api?.listTasks ?? (async () => Object.freeze([])),
    enabled: api !== null,
  });
  const sectionsQuery = useQuery({
    queryKey: sectionQueryKey,
    queryFn: api?.listSections ?? (async () => Object.freeze([])),
    enabled: api !== null,
  });
  const settingsQuery = useQuery({
    queryKey: settingsQueryKey,
    queryFn:
      api?.getSettings ??
      (async () =>
        Object.freeze({ confirmDelete: true, accessMode: "password" as const, username: "admin" })),
    enabled: api !== null,
  });
  const allProjects = projectsQuery.data ?? Object.freeze([]);
  const projectArchivingEnabled = authStatus.data?.projectArchivingEnabled === true;
  const activeProjects = allProjects.filter((project) => !projectArchivingEnabled || !project.archived);
  const navigationProjects = projectTreeOrder(activeProjects);
  const allTasks = tasksQuery.data ?? Object.freeze([]);
  const allSections = sectionsQuery.data ?? Object.freeze([]);
  const closeSidebar = () => setMobileSidebarOpen(false);

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
    goToProject,
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
  } = useSidebarProjectManagement({
    api,
    activeProjects,
    selectedProjectId,
    confirmDelete: settingsQuery.data?.confirmDelete,
    onInboxSelect,
    onProjectSelect,
    closeSidebar,
  });

  useEffect(() => {
    if (addingProject) projectCreateInputRef.current?.focus();
  }, [addingProject]);

  useLayoutEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (openProjectMenuId === null) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".project-menu") === null)
        setOpenProjectMenuId(null);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpenProjectMenuId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openProjectMenuId]);

  const activePage = location.pathname.startsWith("/tools")
    ? "tools"
    : location.pathname.startsWith("/settings")
      ? "settings"
      : location.pathname.startsWith("/admin/users")
        ? "admin-users"
        : location.pathname.startsWith("/archived-projects")
          ? "archived-projects"
          : location.pathname.startsWith("/dates")
            ? "dates"
            : location.pathname.startsWith("/labels")
              ? "labels"
              : location.pathname.startsWith("/attachments")
                ? "attachments"
                : location.pathname.startsWith("/export")
                  ? "export"
                  : location.pathname === "/"
                    ? "tasks"
                    : "";
  const handleTaskSelect = (task: Task) => {
    closeSidebar();
    if (onTaskSelect !== undefined) onTaskSelect(task);
    else navigate(`/?task=${encodeURIComponent(task.id)}`);
  };
  const navLink = (href: string, label: string, icon: ReactElement, page: string) => (
    <Link
      className={clsx("nav-button nav-link-button", activePage === page && "active")}
      to={href}
      onClick={closeSidebar}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <>
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label="Open navigation"
        aria-expanded={mobileSidebarOpen}
        onClick={() => setMobileSidebarOpen(true)}
      >
        <Menu size={23} aria-hidden="true" />
      </button>
      {mobileSidebarOpen ? (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      ) : null}
      <aside
        className={clsx("sidebar card shadow-sm", mobileSidebarOpen && "mobile-sidebar-open")}
        aria-label="Navigation"
        ref={sidebarScroll.ref}
        onScroll={sidebarScroll.onScroll}
      >
        <button
          type="button"
          className="mobile-sidebar-close"
          aria-label="Close navigation"
          onClick={closeSidebar}
        >
          <X size={21} aria-hidden="true" />
        </button>
        <div className="sidebar-brand">
          <span className="brand-mark">mt</span>
          <strong>mytodo</strong>
        </div>
        <SearchPalette
          tasks={flattenTaskNodes(allTasks)}
          projects={allProjects}
          sections={allSections}
          onTaskSelect={handleTaskSelect}
        />
        {onAddTask !== undefined ? (
          <button
            type="button"
            className="nav-button add-task-nav-button"
            onClick={() => {
              closeSidebar();
              onAddTask();
            }}
          >
            <Plus size={17} aria-hidden="true" />
            Add task <kbd>Q</kbd>
          </button>
        ) : (
          <Link className="nav-button add-task-nav-button" to="/?addTask=1" onClick={closeSidebar}>
            <Plus size={17} aria-hidden="true" />
            Add task <kbd>Q</kbd>
          </Link>
        )}
        <button
          type="button"
          className={clsx(
            "nav-button",
            activePage === "tasks" && selectedProjectId === null && "active",
            isProjectDropActive?.(null) && "drop-active",
          )}
          onClick={() => {
            closeSidebar();
            onInboxSelect?.();
            navigate("/");
          }}
          onDragEnter={onInboxDragEnter}
          onDragOver={onInboxDragOver}
          onDragLeave={onInboxDragLeave}
          onDrop={onInboxDrop}
        >
          <Inbox size={16} aria-hidden="true" />
          Inbox
        </button>
        {navLink("/dates", "Dates", <CalendarDays size={16} aria-hidden="true" />, "dates")}
        {navLink("/labels", "Labels", <Tag size={16} aria-hidden="true" />, "labels")}
        {authStatus.data?.attachmentsEnabled === true
          ? navLink("/attachments", "Attachments", <Paperclip size={16} aria-hidden="true" />, "attachments")
          : null}
        {navLink("/export", "Export", <Download size={16} aria-hidden="true" />, "export")}
        {toolsEnabled && authStatus.data?.user?.isAdmin === true
          ? navLink("/tools", "Tools", <Code2 size={16} aria-hidden="true" />, "tools")
          : null}
        {navLink("/settings", "Settings", <Settings size={16} aria-hidden="true" />, "settings")}
        {authStatus.data?.user?.isAdmin === true
          ? navLink("/admin/users", "User management", <Users size={16} aria-hidden="true" />, "admin-users")
          : null}
        {projectArchivingEnabled
          ? navLink(
              "/archived-projects",
              "Archived projects",
              <Archive size={16} aria-hidden="true" />,
              "archived-projects",
            )
          : null}
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
                  draggedProjectRef.current = project.id;
                  setDraggingProjectId(project.id);
                  setActiveProjectDrop(null);
                  event.dataTransfer.setData("application/x-project-id", project.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={cancelProjectDrag}
                onDragOver={markProjectDrop(project)}
                onDragLeave={(event) => {
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
      </aside>
    </>
  );
};
