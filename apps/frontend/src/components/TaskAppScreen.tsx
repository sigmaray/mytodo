import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useFloating } from "@floating-ui/react";
import type { QueryClient } from "@tanstack/react-query";
import { TaskContextMenuPortal } from "./TaskContextMenuPortal";
import { ToastPortal } from "./ToastPortal";
import type { useTaskAppActions } from "../useTaskAppActions";
import type { useTaskAppState } from "../useTaskAppState";
import type { useTaskAppViewModel } from "../useTaskAppViewModel";
import "react-toastify/dist/ReactToastify.css";
import { Download, Edit3, ListChecks, Plus, Trash2 } from "lucide-react";
import "../App.css";
import "../vendor/bootstrap.min.css";
import type { ApplicationApi } from "../api";
import { AddTaskDialog } from "./AddTaskDialog";
import { AppSidebar } from "./AppSidebar";
import { AttachmentLibrary } from "./AttachmentLibrary";
import { ExportPage } from "./ExportPage";
import { TaskAppBoard } from "./TaskAppBoard";
import { TaskAppFilteredPage } from "./TaskAppFilteredPage";
import { TaskAppOverlays } from "./TaskAppOverlays";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { normalizeLabels, shiftCalendarMonth } from "./TaskFormFields";
import { toLocalIsoDate } from "../dateUtils";
import { taskQueryKey } from "../queryKeys";
import {
  copyText,
  createPlacementOptions,
  downloadBlob,
  findTaskNode,
  inboxPlacement,
  parsePlacement,
  projectPlacement,
  sectionPlacement,
} from "../taskAppUtils";

type TaskAppScreenProps = Readonly<{
  api: ApplicationApi;
  attachmentsEnabled: boolean;
  queryClient: QueryClient;
  tasksLoading: boolean;
  tasksError: boolean;
  state: ReturnType<typeof useTaskAppState>;
  actions: ReturnType<typeof useTaskAppActions>;
  viewModel: ReturnType<typeof useTaskAppViewModel>;
  pastedFiles: (data: DataTransfer) => ReadonlyArray<File>;
  notifyAttachedFiles: (files: ReadonlyArray<File>) => void;
}>;

export const TaskAppScreen = ({
  api,
  attachmentsEnabled,
  queryClient,
  tasksLoading,
  tasksError,
  state,
  actions,
  viewModel,
  pastedFiles,
  notifyAttachedFiles,
}: TaskAppScreenProps) => {
  const {
    dateView,
    setDateView,
    dateListFilter,
    setDateListFilter,
    calendarMonth,
    setCalendarMonth,
    activeCalendarDate,
    setActiveCalendarDate,
    addTaskOpen,
    setAddTaskOpen,
    addTaskTitle,
    setAddTaskTitle,
    addTaskDescription,
    setAddTaskDescription,
    addTaskFiles,
    setAddTaskFiles,
    addTaskDate,
    setAddTaskDate,
    addTaskDatePickerOpen,
    setAddTaskDatePickerOpen,
    addTaskDateBeforePicker,
    setAddTaskDateBeforePicker,
    addTaskLabels,
    setAddTaskLabels,
    addTaskLabelInput,
    setAddTaskLabelInput,
    showAddTaskDescription,
    setShowAddTaskDescription,
    showAddTaskDate,
    setShowAddTaskDate,
    showAddTaskLabels,
    setShowAddTaskLabels,
    addTaskPlacement,
    setAddTaskPlacement,
    addTaskBeforeId,
    setAddTaskBeforeId,
    sectionTitle,
    setSectionTitle,
    addingSection,
    setAddingSection,
    editSectionId,
    setEditSectionId,
    editSectionTitle,
    setEditSectionTitle,
    setDraggingTaskId,
    activeDropZone,
    setActiveDropZone,
    activeSectionDrop,
    setActiveSectionDrop,
    draggingSectionId,
    setDraggingSectionId,
    targetProjectId,
    setTargetProjectId,
    editingProjectTitle,
    setEditingProjectTitle,
    projectTitleDraft,
    setProjectTitleDraft,
    targetSectionId,
    setTargetSectionId,
    markdownModal,
    setMarkdownModal,
    scopeExportOpen,
    setScopeExportOpen,
    setDetailsTaskId,
    taskContextMenu,
    setTaskContextMenu,
    selectionMode,
    setSelectionMode,
    selectedMoveOpen,
    setSelectedMoveOpen,
    selectedMovePlacement,
    setSelectedMovePlacement,
    detailTitle,
    setDetailTitle,
    detailDescription,
    setDetailDescription,
    detailDueDate,
    setDetailDueDate,
    detailLabelInput,
    setDetailLabelInput,
    detailSaveStatus,
    setDetailSaveStatus,
    detailProjectId,
    setDetailProjectId,
    detailSectionId,
    setDetailSectionId,
    editingDetailField,
    setEditingDetailField,
    datePickerOpen,
    setDatePickerOpen,
    showMobileLabels,
    setShowMobileLabels,
    showMobileComments,
    setShowMobileComments,
    showMobileDate,
    setShowMobileDate,
    showMobileSubtasks,
    setShowMobileSubtasks,
    detailComment,
    setDetailComment,
    detailCommentFiles,
    setDetailCommentFiles,
    detailSubtask,
    setDetailSubtask,
    editingCommentId,
    setEditingCommentId,
    editingCommentBody,
    setEditingCommentBody,
    copyStatus,
    setCopyStatus,
    calendarDraggedTaskRef,
    subtasksSectionRef,
    sectionCreateInputRef,
  } = state;
  const {
    confirmDeletion,
    updateProjectMutation,
    requestSectionDelete,
    requestTaskDelete,
    selectedMoveMutation,
    submitSection,
    cancelSectionCreate,
    submitSectionEdit,
    startSectionEdit,
    startSubtask,
    markDropZone,
    moveDroppedTask,
    startSectionDrag,
    markSectionDrop,
    dropSection,
    dropTaskOnCalendarDate,
    markCalendarDate,
    startEditing,
    openDetails,
    allTasks,
    flatTasks,
    selectedRootTasks,
    clearSelection,
    availableLabels,
    activeProjects,
    allSections,
    selectedDetailsTask,
    selectedDetailsProject,
    selectedDetailsSection,
    selectedDetailsParent,
    saveTaskDetails,
    removeCommentAttachment,
    closeMobileLabels,
    closeMobileComments,
    closeMobileSubtasks,
  } = actions;
  const {
    inboxSections,
    projectSections,
    inboxRootTasks,
    projectRootTasks,
    scopeDescriptionBlock,
    taskActions,
    taskTargetLabel,
    pageMode,
    selectedLabel,
    viewTasks,
    calendarTasks,
    calendarDays,
    calendarLabel,
    calendarTaskCount,
    calendarTaskLocation,
    viewTitle,
    selectedProject,
    saveProjectTitle,
    taskAttachments,
    markdown,
    openAddTaskDialog,
    deleteAllTasks,
    moveSelectedTasks,
    selectionToolbar,
    finishDndDrag,
    allMarkdown,
    allJson,
    scopeProject,
    advancedMarkdown,
    allAdvancedMarkdown,
    scopeJson,
    exportMarkdown,
    exportAdvancedMarkdown,
  } = viewModel;
  const markdownFloating = useFloating({ open: markdownModal !== null });
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: Object.freeze({ distance: 4 }) }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={finishDndDrag}>
      <ToastPortal />
      <main className="shell app-layout">
        <AppSidebar
          api={api}
          selectedProjectId={targetProjectId}
          onInboxSelect={() => {
            clearSelection();
            setTargetProjectId(null);
            setTargetSectionId(null);
          }}
          onProjectSelect={(id) => {
            clearSelection();
            setTargetProjectId(id);
            setTargetSectionId(null);
          }}
          onTaskSelect={(task) => {
            const node = findTaskNode(allTasks, task.id);
            if (node !== null) openDetails(node);
          }}
          onAddTask={() =>
            openAddTaskDialog(
              pageMode === "tasks"
                ? targetSectionId === null
                  ? targetProjectId === null
                    ? inboxPlacement
                    : projectPlacement(targetProjectId)
                  : sectionPlacement(targetSectionId)
                : inboxPlacement,
            )
          }
          isProjectDropActive={(id) =>
            activeDropZone === (id === null ? inboxPlacement : projectPlacement(id))
          }
          onInboxDragEnter={markDropZone(null, null)}
          onInboxDragOver={markDropZone(null, null)}
          onInboxDragLeave={() => setActiveDropZone(null)}
          onInboxDrop={moveDroppedTask(null, null)}
          onProjectDragEnter={(id) => markDropZone(id, null)}
          onProjectDragOver={(id) => markDropZone(id, null)}
          onProjectDragLeave={() => () => setActiveDropZone(null)}
          onProjectDrop={(id) => moveDroppedTask(id, null)}
        />
        <button
          type="button"
          className="mobile-quick-add"
          aria-label="Quick add task"
          onClick={() =>
            openAddTaskDialog(
              pageMode === "tasks"
                ? targetSectionId === null
                  ? targetProjectId === null
                    ? inboxPlacement
                    : projectPlacement(targetProjectId)
                  : sectionPlacement(targetSectionId)
                : inboxPlacement,
            )
          }
        >
          <Plus size={25} aria-hidden="true" />
        </button>

        <section className="workspace card shadow-sm" aria-label="Task manager">
          <header className="header">
            <p className="eyebrow">Self-hosted MVP</p>
            {pageMode === "tasks" && selectedProject !== null ? (
              editingProjectTitle ? (
                <form
                  className="project-title-edit-form"
                  onSubmit={(event) => void saveProjectTitle(event)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingProjectTitle(false);
                      setProjectTitleDraft("");
                    }
                  }}
                >
                  <label className="visually-hidden" htmlFor="project-title-inline-edit">
                    Project title
                  </label>
                  <input
                    id="project-title-inline-edit"
                    autoFocus
                    value={projectTitleDraft}
                    onChange={(event) => setProjectTitleDraft(event.target.value)}
                    aria-label="Project title"
                  />
                  <button
                    type="submit"
                    disabled={projectTitleDraft.trim().length === 0 || updateProjectMutation.isPending}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProjectTitle(false);
                      setProjectTitleDraft("");
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="project-title-heading">
                  <h1>{selectedProject.title}</h1>
                  <button
                    type="button"
                    className="project-title-edit-trigger"
                    aria-label="Edit project name"
                    title="Edit project name"
                    onClick={() => {
                      setProjectTitleDraft(selectedProject.title);
                      setEditingProjectTitle(true);
                    }}
                  >
                    <Edit3 size={18} aria-hidden="true" />
                  </button>
                </div>
              )
            ) : (
              <h1>{viewTitle}</h1>
            )}
            {pageMode === "tasks" ? (
              <div className="task-header-actions">
                {!selectionMode ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary select-tasks-button"
                    onClick={() => setSelectionMode(true)}
                  >
                    <ListChecks size={16} aria-hidden="true" />
                    Select tasks
                  </button>
                ) : null}
                <button
                  type="button"
                  className="scope-export-trigger btn-primary"
                  onClick={() => setScopeExportOpen(true)}
                >
                  <Download size={16} aria-hidden="true" />
                  Export
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger delete-all-tasks-button"
                  disabled={
                    !flatTasks.some((task) => task.parentId === null && task.projectId === targetProjectId)
                  }
                  onClick={() => void deleteAllTasks()}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Delete all tasks
                </button>
              </div>
            ) : null}
          </header>
          {pageMode === "tasks" ? selectionToolbar : null}
          {tasksLoading ? <p className="muted">Loading tasks...</p> : null}
          {tasksError ? <p className="error">Unable to load tasks.</p> : null}
          {pageMode === "dates" || pageMode === "labels" ? (
            <TaskAppFilteredPage
              mode={pageMode}
              viewTitle={viewTitle}
              dateView={dateView}
              setDateView={setDateView}
              dateListFilter={dateListFilter}
              setDateListFilter={setDateListFilter}
              selectedLabel={selectedLabel}
              flatTasks={flatTasks}
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
                if (node) openDetails(node);
              }}
              viewTasks={viewTasks}
              taskActions={taskActions}
            />
          ) : pageMode === "attachments" && attachmentsEnabled ? (
            <AttachmentLibrary
              attachments={taskAttachments}
              loading={tasksLoading}
              onTaskOpen={(taskId) => {
                const task = findTaskNode(allTasks, taskId);
                if (task !== null) openDetails(task);
              }}
            />
          ) : pageMode === "export" ? (
            <ExportPage
              copyStatus={copyStatus}
              onExport={(kind) => {
                if (kind === "markdown") exportMarkdown();
                else if (kind === "advancedMarkdown") exportAdvancedMarkdown();
                else
                  downloadBlob(
                    new Blob([allJson], { type: "application/json;charset=utf-8" }),
                    "mytodo.json",
                  );
              }}
              onCopy={async (kind) => {
                const content =
                  kind === "markdown"
                    ? allMarkdown
                    : kind === "advancedMarkdown"
                      ? allAdvancedMarkdown
                      : allJson;
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
                  kind === "markdown"
                    ? allMarkdown
                    : kind === "advancedMarkdown"
                      ? allAdvancedMarkdown
                      : allJson;
                setMarkdownModal(
                  Object.freeze({
                    title: kind === "json" ? "All data" : "All tasks",
                    markdown: content,
                    format: kind === "advancedMarkdown" ? "advanced-markdown" : kind,
                  }),
                );
              }}
            />
          ) : (
            <TaskAppBoard
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
          )}{" "}
          {pageMode === "tasks" ? selectionToolbar : null}
        </section>
        <TaskAppOverlays
          selectedMoveOpen={selectedMoveOpen}
          setSelectedMoveOpen={setSelectedMoveOpen}
          selectedRootTasks={selectedRootTasks}
          selectedMovePlacement={selectedMovePlacement}
          setSelectedMovePlacement={setSelectedMovePlacement}
          activeProjects={activeProjects}
          allSections={allSections}
          selectedMovePending={selectedMoveMutation.isPending}
          moveSelectedTasks={moveSelectedTasks}
          markdownModal={markdownModal}
          setMarkdownModal={setMarkdownModal}
          markdownFloating={markdownFloating}
          scopeExportOpen={scopeExportOpen}
          setScopeExportOpen={setScopeExportOpen}
          targetProjectId={targetProjectId}
          scopeProject={scopeProject}
          taskTargetLabel={taskTargetLabel}
          markdown={markdown}
          advancedMarkdown={advancedMarkdown}
          scopeJson={scopeJson}
          copyStatus={copyStatus}
          setCopyStatus={setCopyStatus}
        />
        <AddTaskDialog
          draft={{
            open: addTaskOpen,
            setOpen: setAddTaskOpen,
            title: addTaskTitle,
            setTitle: setAddTaskTitle,
            description: addTaskDescription,
            setDescription: setAddTaskDescription,
            files: addTaskFiles,
            setFiles: setAddTaskFiles,
            date: addTaskDate,
            setDate: setAddTaskDate,
            datePickerOpen: addTaskDatePickerOpen,
            setDatePickerOpen: setAddTaskDatePickerOpen,
            dateBeforePicker: addTaskDateBeforePicker,
            setDateBeforePicker: setAddTaskDateBeforePicker,
            labels: addTaskLabels,
            setLabels: setAddTaskLabels,
            labelInput: addTaskLabelInput,
            setLabelInput: setAddTaskLabelInput,
            showDescription: showAddTaskDescription,
            setShowDescription: setShowAddTaskDescription,
            showDate: showAddTaskDate,
            setShowDate: setShowAddTaskDate,
            showLabels: showAddTaskLabels,
            setShowLabels: setShowAddTaskLabels,
            placement: addTaskPlacement,
            setPlacement: setAddTaskPlacement,
          }}
          attachmentsEnabled={attachmentsEnabled}
          availableLabels={availableLabels}
          placementOptions={createPlacementOptions(
            activeProjects,
            allSections.filter(
              (section) =>
                section.projectId === null ||
                activeProjects.some((project) => project.id === section.projectId),
            ),
          )}
          pastedFiles={pastedFiles}
          notifyAttachedFiles={notifyAttachedFiles}
          onSubmit={async (event) => {
            event.preventDefault();
            const taskTitle = addTaskTitle.trim();
            if (!taskTitle) return;
            const placement = parsePlacement(addTaskPlacement, allSections);
            const created = await api.createTask(taskTitle, placement.projectId, placement.sectionId, null);
            if (addTaskBeforeId !== null)
              await api.moveTask(
                created.id,
                placement.projectId,
                placement.sectionId,
                null,
                addTaskBeforeId,
                null,
              );
            if (addTaskFiles.length) {
              try {
                await api.createComment(created.id, "", addTaskFiles);
              } catch (error) {
                await api.deleteTask(created.id);
                throw error;
              }
            }
            const labels = normalizeLabels([...addTaskLabels, addTaskLabelInput]);
            const patch: Parameters<ApplicationApi["updateTask"]>[1] = {
              description: addTaskDescription,
              dueDate: addTaskDate || null,
              labels,
            };
            if (patch.description || patch.dueDate || patch.labels?.length)
              await api.updateTask(created.id, patch);
            await queryClient.invalidateQueries({ queryKey: taskQueryKey });
            setAddTaskOpen(false);
            setAddTaskBeforeId(null);
          }}
        />
        <TaskDetailsDialog
          api={api}
          queryClient={queryClient}
          attachmentsEnabled={attachmentsEnabled}
          selectedDetailsTask={selectedDetailsTask}
          selectedDetailsProject={selectedDetailsProject}
          selectedDetailsSection={selectedDetailsSection}
          selectedDetailsParent={selectedDetailsParent}
          activeProjects={activeProjects}
          allSections={allSections}
          availableLabels={availableLabels}
          detailTitle={detailTitle}
          detailDescription={detailDescription}
          detailDueDate={detailDueDate}
          detailLabelInput={detailLabelInput}
          detailSaveStatus={detailSaveStatus}
          detailProjectId={detailProjectId}
          detailSectionId={detailSectionId}
          editingDetailField={editingDetailField}
          datePickerOpen={datePickerOpen}
          showMobileLabels={showMobileLabels}
          showMobileComments={showMobileComments}
          showMobileDate={showMobileDate}
          showMobileSubtasks={showMobileSubtasks}
          detailComment={detailComment}
          detailCommentFiles={detailCommentFiles}
          detailSubtask={detailSubtask}
          editingCommentId={editingCommentId}
          editingCommentBody={editingCommentBody}
          subtasksSectionRef={subtasksSectionRef}
          setDetailsTaskId={setDetailsTaskId}
          setDetailTitle={setDetailTitle}
          setDetailDescription={setDetailDescription}
          setDetailDueDate={setDetailDueDate}
          setDetailLabelInput={setDetailLabelInput}
          setDetailSaveStatus={setDetailSaveStatus}
          setDetailProjectId={setDetailProjectId}
          setDetailSectionId={setDetailSectionId}
          setEditingDetailField={setEditingDetailField}
          setDatePickerOpen={setDatePickerOpen}
          setShowMobileLabels={setShowMobileLabels}
          setShowMobileComments={setShowMobileComments}
          setShowMobileDate={setShowMobileDate}
          setShowMobileSubtasks={setShowMobileSubtasks}
          setDetailComment={setDetailComment}
          setDetailCommentFiles={setDetailCommentFiles}
          setDetailSubtask={setDetailSubtask}
          setEditingCommentId={setEditingCommentId}
          setEditingCommentBody={setEditingCommentBody}
          confirmDeletion={confirmDeletion}
          saveTaskDetails={saveTaskDetails}
          removeCommentAttachment={removeCommentAttachment}
          closeMobileLabels={closeMobileLabels}
          closeMobileComments={closeMobileComments}
          closeMobileSubtasks={closeMobileSubtasks}
          openDetails={openDetails}
          notifyAttachedFiles={notifyAttachedFiles}
          pastedFiles={pastedFiles}
        />
      </main>
      <TaskContextMenuPortal
        task={taskContextMenu?.task ?? null}
        left={taskContextMenu?.left ?? 0}
        top={taskContextMenu?.top ?? 0}
        onOpen={() => {
          if (taskContextMenu === null) return;
          setTaskContextMenu(null);
          openDetails(taskContextMenu.task);
        }}
        onQuickEdit={() => {
          if (taskContextMenu === null) return;
          setTaskContextMenu(null);
          startEditing(taskContextMenu.task);
        }}
        onAddSubtask={() => {
          if (taskContextMenu === null) return;
          setTaskContextMenu(null);
          startSubtask(taskContextMenu.task);
        }}
        onDelete={() => {
          if (taskContextMenu === null) return;
          setTaskContextMenu(null);
          requestTaskDelete(taskContextMenu.task);
        }}
      />
    </DndContext>
  );
};
