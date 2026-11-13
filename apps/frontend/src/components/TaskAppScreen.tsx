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
import { TaskAppPageContent } from "./TaskAppPageContent";
import type { useTaskAppActions } from "../useTaskAppActions";
import type { TaskAppScreenState } from "../useTaskAppState";
import type { useTaskAppViewModel } from "../useTaskAppViewModel";
import type { TaskAppPageModel } from "../taskAppPageModel";
import "react-toastify/dist/ReactToastify.css";
import { Download, Edit3, ListChecks, Plus, Trash2 } from "lucide-react";
import "../App.css";
import "../vendor/bootstrap.min.css";
import type { ApplicationApi } from "../api";
import { AddTaskDialog } from "./AddTaskDialog";
import { AppSidebar } from "./AppSidebar";
import { TaskAppOverlays } from "./TaskAppOverlays";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { normalizeLabels } from "./TaskFormFields";
import { taskQueryKey } from "../queryKeys";
import {
  createPlacementOptions,
  findTaskNode,
  inboxPlacement,
  parsePlacement,
  projectPlacement,
  sectionPlacement,
} from "../taskAppUtils";

type TaskAppScreenProps = {
  api: ApplicationApi;
  attachmentsEnabled: boolean;
  queryClient: QueryClient;
  tasksLoading: boolean;
  tasksError: boolean;
  state: TaskAppScreenState;
  actions: ReturnType<typeof useTaskAppActions>;
  viewModel: ReturnType<typeof useTaskAppViewModel>;
  pageModel: TaskAppPageModel;
  pastedFiles: (data: DataTransfer) => Array<File>;
  notifyAttachedFiles: (files: Array<File>) => void;
};

export const TaskAppScreen = ({
  api,
  attachmentsEnabled,
  queryClient,
  tasksLoading,
  tasksError,
  state,
  actions,
  viewModel,
  pageModel,
  pastedFiles,
  notifyAttachedFiles,
}: TaskAppScreenProps) => {
  const {
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
    activeDropZone,
    setActiveDropZone,
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
    subtasksSectionRef,
  } = state;
  const {
    confirmDeletion,
    updateProjectMutation,
    requestTaskDelete,
    selectedMoveMutation,
    startSubtask,
    markDropZone,
    moveDroppedTask,
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
    taskTargetLabel,
    pageMode,
    viewTitle,
    selectedProject,
    saveProjectTitle,
    markdown,
    openAddTaskDialog,
    deleteAllTasks,
    moveSelectedTasks,
    selectionToolbar,
    finishDndDrag,
    scopeProject,
    advancedMarkdown,
    scopeJson,
  } = viewModel;
  const markdownFloating = useFloating({ open: markdownModal !== null });
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
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
          <TaskAppPageContent page={pageModel} />
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
