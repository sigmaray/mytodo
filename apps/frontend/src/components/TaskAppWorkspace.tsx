import type { ApplicationApi } from "../api";
import { TaskApp } from "../TaskApp";

/**
 * Входные параметры корневого workspace, необходимые API-клиенту и функциональным флагам.
 *
 * @typedef {Object} TaskAppWorkspaceProps
 * @property {ApplicationApi} api - Набор API-операций для серверных данных.
 * @property {boolean} attachmentsEnabled - Разрешено ли приложению загружать и выдавать вложения.
 * @property {boolean} projectArchivingEnabled - Разрешено ли архивирование проектов.
 */
export type TaskAppWorkspaceProps = {
  api: ApplicationApi;

  attachmentsEnabled: boolean;

  projectArchivingEnabled: boolean;
};

/**
 * Подключает TaskApp к клиенту и настройкам возможностей приложения.
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
