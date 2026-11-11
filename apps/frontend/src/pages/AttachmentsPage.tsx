import { TaskWorkspacePage } from "./TaskWorkspacePage";
import type { TaskWorkspacePageProps } from "./TaskWorkspacePage";

export const AttachmentsPage = (props: TaskWorkspacePageProps) => (
  <TaskWorkspacePage {...props} pagePath="/attachments" />
);
