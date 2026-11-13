import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useLayoutEffect } from "react";
import { toast } from "react-toastify";
import "./App.css";
import "./vendor/bootstrap.min.css";
import type { ApplicationApi } from "./api";
import { TaskAppScreen } from "./components/TaskAppScreen";
import {
  inboxDescriptionQueryKey,
  projectQueryKey,
  sectionQueryKey,
  settingsQueryKey,
  taskQueryKey,
} from "./queryKeys";
import { useTaskAppActions } from "./useTaskAppActions";
import { useTaskAppState } from "./useTaskAppState";
import { useTaskAppViewModel } from "./useTaskAppViewModel";
import { inboxPlacement, projectPlacement, sectionPlacement } from "./taskAppUtils";

const pastedFiles = (clipboardData: DataTransfer): ReadonlyArray<File> => {
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return Object.freeze(itemFiles.length > 0 ? itemFiles : Array.from(clipboardData.files));
};

const notifyAttachedFiles = (files: ReadonlyArray<File>) =>
  files.forEach((file) => toast.success(`Файл «${file.name}» прикреплён`));

export const TaskApp = ({
  api,
  attachmentsEnabled = false,
  projectArchivingEnabled = false,
}: Readonly<{
  api: ApplicationApi;
  attachmentsEnabled?: boolean;
  projectArchivingEnabled?: boolean;
}>) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const taskAppState = useTaskAppState();
  const {
    addTaskOpen,
    setAddTaskOpen,
    setAddTaskTitle,
    setAddTaskDescription,
    addTaskFiles,
    setAddTaskFiles,
    setAddTaskDate,
    setAddTaskLabels,
    setAddTaskLabelInput,
    setShowAddTaskDescription,
    setShowAddTaskDate,
    setShowAddTaskLabels,
    setAddTaskPlacement,
    addingSection,
    targetProjectId,
    targetSectionId,
    markdownModal,
    scopeExportOpen,
    setScopeExportOpen,
    detailsTaskId,
    setDetailsTaskId,
    taskContextMenu,
    setTaskContextMenu,
    detailLabelInput,
    editingDetailField,
    datePickerOpen,
    showMobileSubtasks,
    detailComment,
    setDetailComment,
    setDetailCommentFiles,
    openProjectMenuId,
    setOpenProjectMenuId,
    subtasksSectionRef,
    sectionCreateInputRef,
    pastedCommentSaveQueueRef,
  } = taskAppState;

  const queryClient = useQueryClient();
  useEffect(() => {
    if (taskContextMenu === null) return;
    const dismiss = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".task-context-menu"))
        setTaskContextMenu(null);
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setTaskContextMenu(null);
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [taskContextMenu]);

  useEffect(() => {
    if (addingSection) sectionCreateInputRef.current?.focus();
  }, [addingSection]);
  useLayoutEffect(() => {
    if (showMobileSubtasks)
      subtasksSectionRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [showMobileSubtasks]);
  useEffect(() => {
    if (openProjectMenuId === null) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".project-menu") === null) setOpenProjectMenuId(null);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpenProjectMenuId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openProjectMenuId]);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && scopeExportOpen && markdownModal === null) setScopeExportOpen(false);
      if (
        event.key === "Escape" &&
        detailsTaskId !== null &&
        editingDetailField === null &&
        !datePickerOpen &&
        detailLabelInput === ""
      )
        setDetailsTaskId(null);
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (
        !isTyping &&
        detailsTaskId === null &&
        markdownModal === null &&
        !scopeExportOpen &&
        !addTaskOpen &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        ["q", "й"].includes(event.key.toLocaleLowerCase())
      ) {
        event.preventDefault();
        setAddTaskPlacement(
          currentPath === "/"
            ? targetSectionId === null
              ? targetProjectId === null
                ? inboxPlacement
                : projectPlacement(targetProjectId)
              : sectionPlacement(targetSectionId)
            : inboxPlacement,
        );
        setAddTaskPlacement(
          currentPath === "/"
            ? targetSectionId === null
              ? targetProjectId === null
                ? inboxPlacement
                : projectPlacement(targetProjectId)
              : sectionPlacement(targetSectionId)
            : inboxPlacement,
        );
        setAddTaskTitle("");
        setAddTaskDescription("");
        setAddTaskDate("");
        setAddTaskLabels(Object.freeze([]));
        setAddTaskLabelInput("");
        setShowAddTaskDescription(false);
        setShowAddTaskDate(false);
        setShowAddTaskLabels(false);
        setAddTaskOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    detailsTaskId,
    markdownModal,
    scopeExportOpen,
    addTaskOpen,
    editingDetailField,
    datePickerOpen,
    detailLabelInput,
    targetProjectId,
    targetSectionId,
    currentPath,
  ]);
  useEffect(() => {
    if (!attachmentsEnabled || (!addTaskOpen && detailsTaskId === null)) return;
    const attachPastedFiles = (event: globalThis.ClipboardEvent) => {
      if (event.clipboardData === null) return;
      const files = pastedFiles(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (addTaskOpen) {
        const acceptedFiles = files.slice(0, Math.max(0, 10 - addTaskFiles.length));
        setAddTaskFiles(Object.freeze([...addTaskFiles, ...acceptedFiles]));
        notifyAttachedFiles(acceptedFiles);
        return;
      }
      if (detailsTaskId === null) return;
      const acceptedFiles = files.slice(0, 10);
      const commentBody = detailComment.trim();
      pastedCommentSaveQueueRef.current = pastedCommentSaveQueueRef.current
        .then(async () => {
          await api.createComment(detailsTaskId, commentBody, acceptedFiles);
          notifyAttachedFiles(acceptedFiles);
          if (commentBody.length > 0)
            setDetailComment((current) => (current.trim() === commentBody ? "" : current));
          await queryClient.invalidateQueries({ queryKey: taskQueryKey });
        })
        .catch(() => {
          setDetailCommentFiles((current) => Object.freeze([...current, ...acceptedFiles].slice(0, 10)));
          acceptedFiles.forEach((file) => toast.error(`Не удалось сохранить файл «${file.name}»`));
        });
    };
    document.addEventListener("paste", attachPastedFiles, true);
    return () => document.removeEventListener("paste", attachPastedFiles, true);
  }, [attachmentsEnabled, addTaskOpen, addTaskFiles, detailsTaskId, detailComment, api, queryClient]);
  const tasks = useQuery({
    queryKey: taskQueryKey,
    queryFn: api.listTasks,
  });

  const projects = useQuery({
    queryKey: projectQueryKey,
    queryFn: api.listProjects,
  });

  const sections = useQuery({
    queryKey: sectionQueryKey,
    queryFn: api.listSections,
  });

  const settings = useQuery({
    queryKey: settingsQueryKey,
    queryFn: api.getSettings,
  });
  const inboxDescriptionQuery = useQuery({
    queryKey: inboxDescriptionQueryKey,
    queryFn: api.getInboxDescription,
  });

  const actions = useTaskAppActions({
    api,
    queryClient,
    state: taskAppState,
    attachmentsEnabled,
    projectArchivingEnabled,
    taskData: tasks.data,
    projectData: projects.data,
    sectionData: sections.data,
    settings: settings.data,
  });

  const viewModel = useTaskAppViewModel({
    api,
    queryClient,
    state: taskAppState,
    actions,
    currentPath,
    attachmentsEnabled,
    inboxDescription: inboxDescriptionQuery.data,
  });

  return (
    <TaskAppScreen
      api={api}
      attachmentsEnabled={attachmentsEnabled}
      queryClient={queryClient}
      tasksLoading={tasks.isLoading}
      tasksError={tasks.isError}
      state={taskAppState}
      actions={actions}
      viewModel={viewModel}
      pastedFiles={pastedFiles}
      notifyAttachedFiles={notifyAttachedFiles}
    />
  );
};
