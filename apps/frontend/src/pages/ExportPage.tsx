import { TaskWorkspacePage } from "./TaskWorkspacePage";
import type { TaskWorkspacePageProps } from "./TaskWorkspacePage";

export const ExportPage = (props: TaskWorkspacePageProps) => (
  <TaskWorkspacePage {...props} pagePath="/export" />
);
