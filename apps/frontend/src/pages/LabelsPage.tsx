import { TaskWorkspacePage } from "./TaskWorkspacePage";
import type { TaskWorkspacePageProps } from "./TaskWorkspacePage";

export const LabelsPage = (props: TaskWorkspacePageProps) => (
  <TaskWorkspacePage {...props} pagePath="/labels" />
);
