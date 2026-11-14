import { AttachmentsPage } from "../pages/AttachmentsPage";
import { DatesPage } from "../pages/DatesPage";
import { ExportPage } from "../pages/ExportPage";
import { InboxPage } from "../pages/InboxPage";
import { LabelsPage } from "../pages/LabelsPage";
import type { TaskAppPageModel } from "../taskAppPageModel";

/**
 * Выбирает компонент страницы по дискриминатору модели маршрута.
 *
 * @param {{ page: TaskAppPageModel; }} parameter1
 * @param {TaskAppPageModel} parameter1.page - Модель, по которой выбирается компонент страницы.
 * @returns Результат выполнения функции.
 */
export const TaskAppPageContent = ({
  /** Модель маршрута и его специфические данные. */
  page,
}: /**
 * Поля этой структуры:
 * - `page`: Модель, по которой выбирается компонент страницы.
 */
{
  page: TaskAppPageModel;
}) => {
  /** Исчерпывающий switch связывает каждый вариант модели с отдельной страницей. */
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
