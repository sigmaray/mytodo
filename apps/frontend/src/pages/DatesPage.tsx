import { TaskWorkspacePage } from "./TaskWorkspacePage";
import type { TaskWorkspacePageProps } from "./TaskWorkspacePage";

export const DatesPage = (props: TaskWorkspacePageProps) => (
  <TaskWorkspacePage {...props} pagePath="/dates" />
);
