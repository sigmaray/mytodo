import { useQuery } from "@tanstack/react-query";
import type { ProjectId, Task } from "@todoist-clone/domain";
import clsx from "clsx";
import {
  Archive,
  CalendarDays,
  Code2,
  Download,
  Inbox,
  Menu,
  Paperclip,
  Plus,
  Settings,
  Tag,
  Users,
  X,
} from "lucide-react";
import type { ReactElement, UIEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ApplicationApi } from "../api";
import { projectTreeOrder } from "../projectTree";
import {
  authStatusQueryKey,
  projectQueryKey,
  sectionQueryKey,
  settingsQueryKey,
  taskQueryKey,
} from "../queryKeys";
import { flattenTaskNodes } from "../taskTreeUtils";
import { SearchPalette } from "./SearchPalette";
import { SidebarProjects } from "./SidebarProjects";
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
  return { ref: sidebarRef, onScroll: rememberScroll };
};

type AppSidebarProps = {
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
};

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
    queryFn: api?.listProjects ?? (async () => []),
    enabled: api !== null,
  });
  const tasksQuery = useQuery({
    queryKey: taskQueryKey,
    queryFn: api?.listTasks ?? (async () => []),
    enabled: api !== null,
  });
  const sectionsQuery = useQuery({
    queryKey: sectionQueryKey,
    queryFn: api?.listSections ?? (async () => []),
    enabled: api !== null,
  });
  const settingsQuery = useQuery({
    queryKey: settingsQueryKey,
    queryFn:
      api?.getSettings ??
      (async () => ({ confirmDelete: true, accessMode: "password" as const, username: "admin" })),
    enabled: api !== null,
  });
  const allProjects = projectsQuery.data ?? [];
  const projectArchivingEnabled = authStatus.data?.projectArchivingEnabled === true;
  const activeProjects = allProjects.filter((project) => !projectArchivingEnabled || !project.archived);
  const navigationProjects = projectTreeOrder(activeProjects);
  const allTasks = tasksQuery.data ?? [];
  const allSections = sectionsQuery.data ?? [];
  const closeSidebar = () => setMobileSidebarOpen(false);

  const projectManagement = useSidebarProjectManagement({
    api,
    activeProjects,
    selectedProjectId,
    confirmDelete: settingsQuery.data?.confirmDelete,
    onInboxSelect,
    onProjectSelect,
    closeSidebar,
  });

  const { addingProject, projectCreateInputRef, openProjectMenuId, setOpenProjectMenuId } = projectManagement;

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
        <SidebarProjects
          api={api}
          navigationProjects={navigationProjects}
          activeProjects={activeProjects}
          selectedProjectId={selectedProjectId}
          activePage={activePage}
          projectArchivingEnabled={projectArchivingEnabled}
          isProjectDropActive={isProjectDropActive}
          onProjectDragEnter={onProjectDragEnter}
          onProjectDragOver={onProjectDragOver}
          onProjectDragLeave={onProjectDragLeave}
          onProjectDrop={onProjectDrop}
          management={projectManagement}
        />
      </aside>
    </>
  );
};
