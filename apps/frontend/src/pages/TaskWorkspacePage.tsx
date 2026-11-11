import type { ApplicationApi } from "../api";
import { TaskApp } from "../TaskApp";

export type TaskWorkspacePageProps = Readonly<{
  api: ApplicationApi;
  attachmentsEnabled: boolean;
  projectArchivingEnabled: boolean;
}>;

export const TaskWorkspacePage = ({
  api,
  attachmentsEnabled,
  projectArchivingEnabled,
  pagePath,
}: TaskWorkspacePageProps & Readonly<{ pagePath: string }>) => (
  <TaskApp
    api={api}
    attachmentsEnabled={attachmentsEnabled}
    projectArchivingEnabled={projectArchivingEnabled}
    pagePath={pagePath}
  />
);
