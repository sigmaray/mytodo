import { CalendarDays, Plus, X } from "lucide-react";
import { isTaskDueToday, taskDueDateTone } from "../dateUtils";
import { taskQueryKey } from "../queryKeys";
import {
  createPlacementOptions,
  inboxPlacement,
  parsePlacement,
  projectPlacement,
  sectionPlacement,
} from "../taskAppUtils";
import type { TaskDetailsDialogProps } from "./TaskDetailsDialog";
import { LabelPicker } from "./TaskFormFields";

export const TaskDetailsSidebar = ({
  api,
  queryClient,
  selectedDetailsTask,
  activeProjects,
  allSections,
  availableLabels,
  detailDueDate,
  detailLabelInput,
  detailSaveStatus,
  detailProjectId,
  detailSectionId,
  showMobileLabels,
  showMobileComments,
  showMobileDate,
  showMobileSubtasks,
  setDetailDueDate,
  setDetailLabelInput,
  setDetailSaveStatus,
  setDetailProjectId,
  setDetailSectionId,
  setDatePickerOpen,
  setShowMobileLabels,
  setShowMobileComments,
  setShowMobileDate,
  setShowMobileSubtasks,
  saveTaskDetails,
  closeMobileLabels,
}: TaskDetailsDialogProps) => {
  if (selectedDetailsTask === null) return null;
  return (
    <aside className="task-details-sidebar">
      <div className="task-details-mobile-shortcuts">
        {!selectedDetailsTask.labels.length && !showMobileLabels ? (
          <button type="button" onClick={() => setShowMobileLabels(true)}>
            <Plus size={15} aria-hidden="true" />
            Labels
          </button>
        ) : null}
        {!detailDueDate && !showMobileDate ? (
          <button
            type="button"
            onClick={() => {
              setShowMobileDate(true);
              setDatePickerOpen(true);
            }}
          >
            <Plus size={15} aria-hidden="true" />
            Date
          </button>
        ) : null}
        {selectedDetailsTask.children.length === 0 && !showMobileSubtasks ? (
          <button
            type="button"
            aria-expanded="false"
            aria-controls="task-subtasks-section"
            onClick={() => setShowMobileSubtasks(true)}
          >
            <Plus size={15} aria-hidden="true" />
            Subtasks
          </button>
        ) : null}
        {!selectedDetailsTask.comments.length && !showMobileComments ? (
          <button type="button" onClick={() => setShowMobileComments(true)}>
            <Plus size={15} aria-hidden="true" />
            Comments
          </button>
        ) : null}
      </div>
      <section>
        <h3>Project</h3>
        <select
          className="form-select"
          aria-label="Project, section, or Inbox"
          value={
            detailSectionId === null
              ? detailProjectId === null
                ? inboxPlacement
                : projectPlacement(detailProjectId)
              : sectionPlacement(detailSectionId)
          }
          onChange={async (event) => {
            const placement = parsePlacement(event.target.value, allSections);
            setDetailProjectId(placement.projectId);
            setDetailSectionId(placement.sectionId);
            setDetailSaveStatus("Saving…");
            try {
              await api.moveTask(
                selectedDetailsTask.id,
                placement.projectId,
                placement.sectionId,
                null,
                null,
                null,
              );
              await queryClient.invalidateQueries({ queryKey: taskQueryKey });
              setDetailSaveStatus("Saved");
            } catch {
              setDetailProjectId(selectedDetailsTask.projectId);
              setDetailSectionId(selectedDetailsTask.sectionId);
              setDetailSaveStatus("Could not save changes");
            }
          }}
        >
          {createPlacementOptions(
            activeProjects,
            allSections.filter(
              (section) =>
                section.projectId === null ||
                activeProjects.some((project) => project.id === section.projectId),
            ),
          ).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>
      <section
        className={`task-details-optional${!detailDueDate && !showMobileDate ? " task-details-optional-hidden" : ""}`}
      >
        <div className="task-details-optional-heading">
          <h3>Date</h3>
          <button
            type="button"
            className="task-details-mobile-collapse"
            aria-label="Remove date and hide section"
            onClick={async () => {
              setDetailDueDate("");
              setShowMobileDate(false);
              await saveTaskDetails({ dueDate: null });
            }}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        {detailDueDate ? (
          <div className="task-detail-meta-value">
            <button
              type="button"
              className={`task-detail-date ${taskDueDateTone(detailDueDate)}`}
              onClick={() => setDatePickerOpen(true)}
              title={`Due ${detailDueDate}`}
            >
              <CalendarDays size={15} aria-hidden="true" />
              <span>
                {isTaskDueToday(detailDueDate)
                  ? "today"
                  : new Date(`${detailDueDate}T00:00:00`).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
              </span>
            </button>
            <button
              type="button"
              className="task-details-desktop-remove-date"
              aria-label="Remove date"
              onClick={async () => {
                setDetailDueDate("");
                setShowMobileDate(false);
                await saveTaskDetails({ dueDate: null });
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setShowMobileDate(true);
              setDatePickerOpen(true);
            }}
          >
            ＋ Add date
          </button>
        )}
      </section>
      <section
        className={`task-details-optional${selectedDetailsTask.labels.length === 0 && !showMobileLabels ? " task-details-optional-hidden" : ""}`}
      >
        <div className="task-details-optional-heading">
          <h3>Labels</h3>
          <button
            type="button"
            className="task-details-mobile-collapse"
            aria-label="Remove all labels and hide section"
            onClick={() => void closeMobileLabels()}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <LabelPicker
          autoFocus={showMobileLabels && selectedDetailsTask.labels.length === 0}
          selected={selectedDetailsTask.labels}
          options={availableLabels}
          inputLabel="Labels"
          inputValue={detailLabelInput}
          onInputChange={setDetailLabelInput}
          onChange={(labels) => saveTaskDetails({ labels })}
        />
      </section>
      <p className="task-autosave-status" aria-live="polite">
        {detailSaveStatus}
      </p>
    </aside>
  );
};
