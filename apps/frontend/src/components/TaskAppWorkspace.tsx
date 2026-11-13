import type { ApplicationApi } from "../api";
import { TaskApp } from "../TaskApp";

export type TaskAppWorkspaceProps = Readonly<{
  api: ApplicationApi;
  attachmentsEnabled: boolean;
  projectArchivingEnabled: boolean;
}>;

export const TaskAppWorkspace = ({
  api,
  attachmentsEnabled,
  projectArchivingEnabled,
}: TaskAppWorkspaceProps) => (
  <TaskApp
    api={api}
    attachmentsEnabled={attachmentsEnabled}
    projectArchivingEnabled={projectArchivingEnabled}
  />
);
