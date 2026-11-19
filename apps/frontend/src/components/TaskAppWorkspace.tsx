import type { ApplicationApi } from "../api";
import { TaskApp } from "../TaskApp";

/**
 * Root workspace inputs required by the API client and feature flags.
 *
 * @typedef {Object} TaskAppWorkspaceProps
 * @property {ApplicationApi} api - API operations for server data.
 * @property {boolean} attachmentsEnabled - Whether the application can upload and serve attachments.
 * @property {boolean} projectArchivingEnabled - Whether project archiving is enabled.
 */
export type TaskAppWorkspaceProps = {
  api: ApplicationApi;

  attachmentsEnabled: boolean;

  projectArchivingEnabled: boolean;
};

/**
 * Connects TaskApp to the API client and application capability settings.
 *
 * @param {TaskAppWorkspaceProps} parameter1
 */
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
