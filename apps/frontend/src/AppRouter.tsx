import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { createTaskApi, createToolsApi } from "./api";
import { AppSidebar } from "./components/AppSidebar";
import { authStatusQueryKey } from "./queryKeys";

const ToolsPage = lazy(() => import("./pages/ToolsPage").then((page) => ({ default: page.ToolsPage })));
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((page) => ({ default: page.SettingsPage })),
);
const AdminUsersPage = lazy(() =>
  import("./pages/AdminUsersPage").then((page) => ({ default: page.AdminUsersPage })),
);
const ArchivedProjectsPage = lazy(() =>
  import("./pages/ArchivedProjectsPage").then((page) => ({ default: page.ArchivedProjectsPage })),
);
const LoginPage = lazy(() => import("./pages/LoginPage").then((page) => ({ default: page.LoginPage })));
const InboxPage = lazy(() => import("./pages/InboxPage").then((page) => ({ default: page.InboxPage })));
const DatesPage = lazy(() => import("./pages/DatesPage").then((page) => ({ default: page.DatesPage })));
const LabelsPage = lazy(() => import("./pages/LabelsPage").then((page) => ({ default: page.LabelsPage })));
const AttachmentsPage = lazy(() =>
  import("./pages/AttachmentsPage").then((page) => ({ default: page.AttachmentsPage })),
);
const ExportPage = lazy(() => import("./pages/ExportPage").then((page) => ({ default: page.ExportPage })));
const TaskWorkspacePage = lazy(() =>
  import("./pages/TaskWorkspacePage").then((page) => ({ default: page.TaskWorkspacePage })),
);

export const AppRouter = () => {
  const api = createTaskApi();
  const authStatus = useQuery({ queryKey: authStatusQueryKey, queryFn: api.getAuthStatus });
  const path = useLocation().pathname;

  if (authStatus.isLoading) return <main className="auth-loading">Loading…</main>;
  if (authStatus.isError || authStatus.data === undefined)
    return <main className="auth-loading error">Unable to check workspace access.</main>;

  if (authStatus.data.accessMode === "password" && !authStatus.data.authenticated) {
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <LoginPage api={api} />
      </Suspense>
    );
  }

  if (path.startsWith("/attachments") && authStatus.data.attachmentsEnabled !== true)
    return <Navigate to="/" replace />;

  if (
    (path.startsWith("/admin/users") || path.startsWith("/tools")) &&
    authStatus.data.user?.isAdmin !== true
  )
    return <Navigate to="/" replace />;
  if (path.startsWith("/archived-projects") && authStatus.data.projectArchivingEnabled !== true)
    return <Navigate to="/" replace />;

  const workspaceProps = {
    api,
    attachmentsEnabled: authStatus.data.attachmentsEnabled === true,
    projectArchivingEnabled: authStatus.data.projectArchivingEnabled === true,
  };

  return (
    <Suspense fallback={<main className="auth-loading">Loading…</main>}>
      {path.startsWith("/admin/users") ? (
        <AdminUsersPage api={api} sidebar={<AppSidebar api={api} />} />
      ) : path.startsWith("/settings") ? (
        <SettingsPage api={api} sidebar={<AppSidebar api={api} />} />
      ) : path.startsWith("/archived-projects") ? (
        <ArchivedProjectsPage api={api} sidebar={<AppSidebar api={api} />} />
      ) : path.startsWith("/tools") ? (
        <ToolsPage api={createToolsApi()} sidebar={<AppSidebar api={api} />} />
      ) : path === "/dates" ? (
        <DatesPage {...workspaceProps} />
      ) : path === "/labels" ? (
        <LabelsPage {...workspaceProps} />
      ) : path === "/attachments" ? (
        <AttachmentsPage {...workspaceProps} />
      ) : path === "/export" ? (
        <ExportPage {...workspaceProps} />
      ) : path === "/" ? (
        <InboxPage {...workspaceProps} />
      ) : (
        <TaskWorkspacePage {...workspaceProps} pagePath={path} />
      )}
    </Suspense>
  );
};
