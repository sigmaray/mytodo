import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { createTaskApi, createToolsApi } from "./api";
import { AppSidebar } from "./components/AppSidebar";
import { authStatusQueryKey } from "./queryKeys";
import { TaskApp } from "./TaskApp";

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

  if (path.startsWith("/admin/users")) {
    if (authStatus.data.user?.isAdmin !== true) return <Navigate to="/" replace />;
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <AdminUsersPage api={api} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    );
  }

  if (path.startsWith("/settings")) {
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <SettingsPage api={api} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    );
  }

  if (path.startsWith("/archived-projects"))
    return authStatus.data.projectArchivingEnabled === true ? (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <ArchivedProjectsPage api={api} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    ) : (
      <Navigate to="/" replace />
    );

  if (path.startsWith("/tools")) {
    if (authStatus.data.user?.isAdmin !== true) return <Navigate to="/" replace />;
    return (
      <Suspense fallback={<main className="auth-loading">Loading…</main>}>
        <ToolsPage api={createToolsApi()} sidebar={<AppSidebar api={api} />} />
      </Suspense>
    );
  }

  return (
    <TaskApp
      api={api}
      attachmentsEnabled={authStatus.data.attachmentsEnabled === true}
      projectArchivingEnabled={authStatus.data.projectArchivingEnabled === true}
    />
  );
};
