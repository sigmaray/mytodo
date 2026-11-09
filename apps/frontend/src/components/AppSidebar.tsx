import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, Task } from "@todoist-clone/domain";
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
import type { DragEvent, FormEvent, ReactElement, PointerEvent as ReactPointerEvent, UIEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ApplicationApi } from "../api";
import { isProjectWithinTree, projectDepth, projectTreeOrder } from "../projectTree";
import { appendById, removeById, replaceById } from "../queryData";
import {
  authStatusQueryKey,
  projectQueryKey,
  sectionQueryKey,
  settingsQueryKey,
  taskQueryKey,
} from "../queryKeys";
import { flattenTaskNodes } from "../taskTreeUtils";
import { SearchPalette } from "./SearchPalette";

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
  const queryClient = useQueryClient();
  const sidebarScroll = useSidebarScrollPosition();
  const authStatus = useQuery({
    queryKey: authStatusQueryKey,
    queryFn: api?.getAuthStatus ?? (async () => null),
    enabled: api !== null,
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
    if (
      settingsQuery.data?.confirmDelete !== false &&
      !window.confirm(`Delete project “${project.title}” and all its tasks?`)
    )
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
