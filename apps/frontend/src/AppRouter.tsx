import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
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
const TaskAppWorkspace = lazy(() =>
  import("./components/TaskAppWorkspace").then((page) => ({ default: page.TaskAppWorkspace })),
);

/**
 * Selects pages by URL and lazy-loads the application's larger sections.
 *
 * @returns The application router.
 */
export const AppRouter = () => {
  const api = createTaskApi();
  const authStatus = useQuery({ queryKey: authStatusQueryKey, queryFn: api.getAuthStatus });
  const toolsApi = useMemo(() => createToolsApi(), []);

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

  const workspaceProps = {
    api,
    attachmentsEnabled: authStatus.data.attachmentsEnabled === true,
    projectArchivingEnabled: authStatus.data.projectArchivingEnabled === true,
  };
  const isAdmin = authStatus.data.user?.isAdmin === true;
  const sidebar = <AppSidebar api={api} />;

  return (
    <Suspense fallback={<main className="auth-loading">Loading…</main>}>
      <Routes>
        <Route
          path="/admin/users/*"
          element={isAdmin ? <AdminUsersPage api={api} sidebar={sidebar} /> : <Navigate to="/" replace />}
        />
        <Route path="/settings/*" element={<SettingsPage api={api} sidebar={sidebar} />} />
        <Route
          path="/archived-projects/*"
          element={
            workspaceProps.projectArchivingEnabled ? (
              <ArchivedProjectsPage api={api} sidebar={sidebar} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/tools/*"
          element={isAdmin ? <ToolsPage api={toolsApi} sidebar={sidebar} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/attachments/*"
          element={
            workspaceProps.attachmentsEnabled ? (
              <TaskAppWorkspace {...workspaceProps} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/dates" element={<TaskAppWorkspace {...workspaceProps} />} />
        <Route path="/labels" element={<TaskAppWorkspace {...workspaceProps} />} />
        <Route path="/export" element={<TaskAppWorkspace {...workspaceProps} />} />
        <Route path="/" element={<TaskAppWorkspace {...workspaceProps} />} />
        <Route path="*" element={<TaskAppWorkspace {...workspaceProps} />} />
      </Routes>
    </Suspense>
  );
};
