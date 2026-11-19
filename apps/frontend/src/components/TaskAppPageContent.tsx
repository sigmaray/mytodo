import { AttachmentsPage } from "../pages/AttachmentsPage";
import { DatesPage } from "../pages/DatesPage";
import { ExportPage } from "../pages/ExportPage";
import { InboxPage } from "../pages/InboxPage";
import { LabelsPage } from "../pages/LabelsPage";
import type { TaskAppPageModel } from "../taskAppPageModel";

/**
 * Selects a page component using the route model discriminator.
 *
 * @param {{ page: TaskAppPageModel; }} parameter1
 * @param {TaskAppPageModel} parameter1.page - Model used to select the page component.
 * @returns The component for the selected route.
 */
export const TaskAppPageContent = ({
  /** Route model and its page-specific data. */
  page,
}: {
  page: TaskAppPageModel;
}) => {
  /** This exhaustive switch maps each model variant to a dedicated page. */
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
