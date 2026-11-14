import type { ApplicationApi } from "../api";
import { TaskApp } from "../TaskApp";

/** Входные параметры корневого workspace, необходимые API-клиенту и функциональным флагам. */
export type TaskAppWorkspaceProps = {
  /** Клиент запросов и мутаций приложения. */
  api: ApplicationApi;
  /** Разрешено ли использовать файловые вложения. */
  attachmentsEnabled: boolean;
  /** Разрешено ли архивирование проектов. */
  projectArchivingEnabled: boolean;
};

/** Подключает TaskApp к клиенту и настройкам возможностей приложения. */
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
