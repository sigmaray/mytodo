import { AttachmentsPage } from "../pages/AttachmentsPage";
import { DatesPage } from "../pages/DatesPage";
import { ExportPage } from "../pages/ExportPage";
import { InboxPage } from "../pages/InboxPage";
import { LabelsPage } from "../pages/LabelsPage";
import type { useTaskAppActions } from "../useTaskAppActions";
import type { useTaskAppState } from "../useTaskAppState";
import type { useTaskAppViewModel } from "../useTaskAppViewModel";
import { copyText, downloadBlob, findTaskNode } from "../taskAppUtils";
import { shiftCalendarMonth } from "./TaskFormFields";
import { toLocalIsoDate } from "../dateUtils";

type TaskAppPageContentProps = Readonly<{
  attachmentsEnabled: boolean;
  tasksLoading: boolean;
  state: ReturnType<typeof useTaskAppState>;
  actions: ReturnType<typeof useTaskAppActions>;
  viewModel: ReturnType<typeof useTaskAppViewModel>;
}>;

export const TaskAppPageContent = ({
  attachmentsEnabled,
  tasksLoading,
  state,
  actions,
  viewModel,
}: TaskAppPageContentProps) => {
  const {
    dateView,
    setDateView,
    dateListFilter,
    setDateListFilter,
    calendarMonth,
    setCalendarMonth,
    activeCalendarDate,
    setActiveCalendarDate,
    setDraggingTaskId,
    setMarkdownModal,
    setCopyStatus,
    copyStatus,
    calendarDraggedTaskRef,
    targetProjectId,
    activeDropZone,
    setActiveDropZone,
    addingSection,
    setAddingSection,
    sectionTitle,
    setSectionTitle,
    sectionCreateInputRef,
    draggingSectionId,
    setDraggingSectionId,
    activeSectionDrop,
    setActiveSectionDrop,
    editSectionId,
    setEditSectionId,
    editSectionTitle,
    setEditSectionTitle,
  } = state;
  const {
    allTasks,
    flatTasks,
    markCalendarDate,
    dropTaskOnCalendarDate,
    openDetails,
    markDropZone,
    moveDroppedTask,
    submitSection,
    cancelSectionCreate,
    startSectionDrag,
    markSectionDrop,
    dropSection,
    submitSectionEdit,
    requestSectionDelete,
    startSectionEdit,
  } = actions;
  const {
    pageMode,
    viewTitle,
    selectedLabel,
    viewTasks,
    calendarTasks,
    calendarDays,
    calendarLabel,
    calendarTaskCount,
    calendarTaskLocation,
    taskActions,
    taskAttachments,
    scopeDescriptionBlock,
    inboxRootTasks,
    projectRootTasks,
    openAddTaskDialog,
    inboxSections,
    projectSections,
    taskTargetLabel,
    exportMarkdown,
    exportAdvancedMarkdown,
    allMarkdown,
    allJson,
    allAdvancedMarkdown,
  } = viewModel;

  if (pageMode === "dates") {
    return (
      <DatesPage
        dateView={dateView}
        setDateView={setDateView}
        dateListFilter={dateListFilter}
        setDateListFilter={setDateListFilter}
        calendarMonth={calendarMonth}
        calendarLabel={calendarLabel}
        calendarDays={calendarDays}
        calendarTasks={calendarTasks}
        calendarTaskCount={calendarTaskCount}
        activeCalendarDate={activeCalendarDate}
        calendarTaskLocation={calendarTaskLocation}
        setCalendarMonth={setCalendarMonth}
        shiftCalendarMonth={(amount) => setCalendarMonth((month) => shiftCalendarMonth(month, amount))}
        onToday={() => setCalendarMonth(toLocalIsoDate(new Date()).slice(0, 7))}
        onMarkDate={markCalendarDate}
        onDropDate={dropTaskOnCalendarDate}
        onLeaveDate={() => setActiveCalendarDate(null)}
        onTaskDragStart={(task, event) => {
          calendarDraggedTaskRef.current = task.id;
          setDraggingTaskId(task.id);
          event.dataTransfer.setData("text/task-id", task.id);
          event.dataTransfer.effectAllowed = "move";
        }}
        onTaskDragEnd={() => {
          calendarDraggedTaskRef.current = null;
          setDraggingTaskId(null);
          setActiveCalendarDate(null);
        }}
        onTaskOpen={(task) => {
          const node = findTaskNode(allTasks, task.id);
          if (node !== null) openDetails(node);
        }}
        viewTasks={viewTasks}
        taskActions={taskActions}
      />
    );
  }

  if (pageMode === "labels")
    return (
      <LabelsPage
        selectedLabel={selectedLabel}
        viewTitle={viewTitle}
        flatTasks={flatTasks}
        viewTasks={viewTasks}
        taskActions={taskActions}
      />
    );

  if (pageMode === "attachments" && attachmentsEnabled)
    return (
      <AttachmentsPage
        attachments={taskAttachments}
        loading={tasksLoading}
        onTaskOpen={(taskId) => {
          const task = findTaskNode(allTasks, taskId);
          if (task !== null) openDetails(task);
        }}
      />
    );

  if (pageMode === "export")
    return (
      <ExportPage
        copyStatus={copyStatus}
        onExport={(kind) => {
          if (kind === "markdown") exportMarkdown();
          else if (kind === "advancedMarkdown") exportAdvancedMarkdown();
          else downloadBlob(new Blob([allJson], { type: "application/json;charset=utf-8" }), "mytodo.json");
        }}
        onCopy={async (kind) => {
          const content =
            kind === "markdown" ? allMarkdown : kind === "advancedMarkdown" ? allAdvancedMarkdown : allJson;
          await copyText(content);
          setCopyStatus(
            kind === "markdown"
              ? "All markdown copied"
              : kind === "advancedMarkdown"
                ? "All advanced markdown copied"
                : "All JSON copied",
          );
        }}
        onPreview={(kind) => {
          const content =
            kind === "markdown" ? allMarkdown : kind === "advancedMarkdown" ? allAdvancedMarkdown : allJson;
          setMarkdownModal(
            Object.freeze({
              title: kind === "json" ? "All data" : "All tasks",
              markdown: content,
              format: kind === "advancedMarkdown" ? "advanced-markdown" : kind,
            }),
          );
        }}
      />
    );

  return (
    <InboxPage
      targetProjectId={targetProjectId}
      scopeDescriptionBlock={scopeDescriptionBlock}
      activeDropZone={activeDropZone}
      clearDropZone={() => setActiveDropZone(null)}
      markDropZone={markDropZone}
      moveDroppedTask={moveDroppedTask}
      inboxRootTasks={inboxRootTasks}
      projectRootTasks={projectRootTasks}
      openAddTaskDialog={openAddTaskDialog}
      addingSection={addingSection}
      setAddingSection={setAddingSection}
      submitSection={submitSection}
      cancelSectionCreate={cancelSectionCreate}
      sectionTitle={sectionTitle}
      setSectionTitle={setSectionTitle}
      sectionCreateInputRef={sectionCreateInputRef}
      inboxSections={inboxSections}
      projectSections={projectSections}
      allTasks={allTasks}
      draggingSectionId={draggingSectionId}
      setDraggingSectionId={setDraggingSectionId}
      activeSectionDrop={activeSectionDrop}
      setActiveSectionDrop={setActiveSectionDrop}
      editSectionId={editSectionId}
      setEditSectionId={setEditSectionId}
      editSectionTitle={editSectionTitle}
      setEditSectionTitle={setEditSectionTitle}
      startSectionDrag={startSectionDrag}
      markSectionDrop={markSectionDrop}
      dropSection={dropSection}
      submitSectionEdit={submitSectionEdit}
      requestSectionDelete={requestSectionDelete}
      startSectionEdit={startSectionEdit}
      taskActions={taskActions}
      taskTargetLabel={taskTargetLabel}
    />
  );
};
