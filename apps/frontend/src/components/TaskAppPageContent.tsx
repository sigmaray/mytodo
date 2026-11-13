import { AttachmentsPage } from "../pages/AttachmentsPage";
import { DatesPage } from "../pages/DatesPage";
import { ExportPage } from "../pages/ExportPage";
import { InboxPage } from "../pages/InboxPage";
import { LabelsPage } from "../pages/LabelsPage";
import type { TaskAppPageModel } from "../taskAppPageModel";

export const TaskAppPageContent = ({ page }: { page: TaskAppPageModel }) => {
  switch (page.mode) {
    case "dates":
      return <DatesPage {...page.props} />;
    case "labels":
      return <LabelsPage {...page.props} />;
    case "attachments":
      return <AttachmentsPage {...page.props} />;
    case "export":
      return <ExportPage {...page.props} />;
    case "inbox":
      return <InboxPage {...page.props} />;
  }
};
