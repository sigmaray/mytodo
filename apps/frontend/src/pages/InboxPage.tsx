import clsx from "clsx";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { inboxPlacement, projectPlacement, sectionPlacement } from "../taskAppUtils";
import type { TaskAppBoardProps } from "../components/TaskAppBoardTypes";
import { renderTaskNodes } from "../components/TaskTreeView";

/**
 * Отображает общий board Inbox/Projects и связывает его с переданными действиями.
 *
 * @param {TaskAppBoardProps} props
 * @returns Результат выполнения функции.
 */
export const InboxPage = (props: TaskAppBoardProps) => {
  const {
    targetProjectId,
    scopeDescriptionBlock,
    activeDropZone,
    clearDropZone,
    markDropZone,
    moveDroppedTask,
    inboxRootTasks,
    projectRootTasks,
    openAddTaskDialog,
    addingSection,
    setAddingSection,
    submitSection,
    cancelSectionCreate,
    sectionTitle,
    setSectionTitle,
    sectionCreateInputRef,
    inboxSections,
    projectSections,
    allTasks,
    draggingSectionId,
    setDraggingSectionId,
    activeSectionDrop,
    setActiveSectionDrop,
    editSectionId,
    setEditSectionId,
    editSectionTitle,
    setEditSectionTitle,
    startSectionDrag,
    markSectionDrop,
    dropSection,
    submitSectionEdit,
    requestSectionDelete,
    startSectionEdit,
    taskActions,
    taskTargetLabel,
  } = props;
  return targetProjectId === null ? (
    <div className="board">
      {scopeDescriptionBlock}
      <section
        className={clsx("drop-zone", activeDropZone === "inbox" && "drop-active")}
        onDragEnter={markDropZone(null, null)}
        onDragOver={markDropZone(null, null)}
        onDragLeave={() => clearDropZone()}
        onDrop={moveDroppedTask(null, null)}
        aria-label="Inbox tasks"
      >
        <div className="task-scope-heading">
          <h2>Inbox</h2>
          <button
            type="button"
            className="scope-add-task-button"
            aria-label="Add task to Inbox"
            onClick={() => openAddTaskDialog(inboxPlacement, inboxRootTasks[0]?.id ?? null)}
          >
            <Plus size={16} aria-hidden="true" />
            Add task
          </button>
        </div>
        {inboxRootTasks.length > 0 ? (
          <>
            {renderTaskNodes(inboxRootTasks, taskActions)}
            <button
              type="button"
              className="scope-add-task-button"
              aria-label="Add task to bottom of Inbox"
              onClick={() => openAddTaskDialog(inboxPlacement)}
            >
              <Plus size={14} aria-hidden="true" />
              Add task
            </button>
          </>
        ) : (
          <p className="empty">No inbox tasks yet.</p>
        )}
      </section>
      <div className="section-create-block">
        {addingSection ? (
          <form
            className="inline-create-form"
            onSubmit={submitSection}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelSectionCreate();
              }
            }}
          >
            <label htmlFor="section-title">Title</label>
            <input
              ref={sectionCreateInputRef}
              id="section-title"
              aria-label="Section title"
              value={sectionTitle}
              onChange={(event) => setSectionTitle(event.target.value)}
            />
            <div>
              <button type="submit" className="btn-primary">
                Save
              </button>
              <button type="button" onClick={cancelSectionCreate}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="add-section-trigger"
            onClick={() => {
              setSectionTitle("");
              setAddingSection(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Add section
          </button>
        )}
      </div>
      {inboxSections.map((section) => {
        const sectionTasks = allTasks.filter(
          (task) => task.projectId === null && task.sectionId === section.id,
        );

        return (
          <section
            key={section.id}
            data-mobile-drop-section={section.id}
            className={clsx("drop-zone", activeDropZone === sectionPlacement(section.id) && "drop-active")}
            onDragEnter={markDropZone(null, section.id)}
            onDragOver={markDropZone(null, section.id)}
            onDragLeave={() => clearDropZone()}
            onDrop={moveDroppedTask(null, section.id)}
            aria-label={`Section ${section.title}`}
          >
            <div
              className={clsx(
                "section-header",
                draggingSectionId === section.id && "section-dragging",
                activeSectionDrop?.id === section.id && `section-drop-${activeSectionDrop.position}`,
              )}
              draggable={editSectionId !== section.id}
              onDragStart={startSectionDrag(section)}
              onDragEnd={() => {
                setDraggingSectionId(null);
                setActiveSectionDrop(null);
              }}
              onDragEnter={markSectionDrop(section)}
              onDragOver={markSectionDrop(section)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setActiveSectionDrop(null);
              }}
              onDrop={dropSection(section, inboxSections)}
            >
              {editSectionId === section.id ? (
                <form
                  className="section-edit-form"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditSectionId(null);
                      setEditSectionTitle("");
                    }
                  }}
                  onSubmit={submitSectionEdit(section)}
                >
                  <label htmlFor={`section-edit-${section.id}`}>Section title</label>
                  <input
                    id={`section-edit-${section.id}`}
                    autoFocus
                    value={editSectionTitle}
                    onChange={(event) => setEditSectionTitle(event.target.value)}
                  />
                  <button type="submit">Save section</button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditSectionId(null);
                      setEditSectionTitle("");
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <h2>{section.title}</h2>
                  <div className="section-actions">
                    <button
                      type="button"
                      aria-label={`Edit section ${section.title}`}
                      onClick={() => startSectionEdit(section)}
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Delete section ${section.title}`}
                      onClick={() => requestSectionDelete(section)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
            {editSectionId !== section.id ? (
              <button
                type="button"
                className="scope-add-task-button"
                aria-label={`Add task to section ${section.title}`}
                onClick={() => openAddTaskDialog(sectionPlacement(section.id), sectionTasks[0]?.id ?? null)}
              >
                <Plus size={16} aria-hidden="true" />
                Add task
              </button>
            ) : null}
            {sectionTasks.length > 0 ? (
              <>
                {renderTaskNodes(sectionTasks, taskActions)}
                <button
                  type="button"
                  className="scope-add-task-button"
                  aria-label={`Add task to bottom of section ${section.title}`}
                  onClick={() => openAddTaskDialog(sectionPlacement(section.id))}
                >
                  <Plus size={14} aria-hidden="true" />
                  Add task
                </button>
              </>
            ) : (
              <p className="empty">Drop inbox tasks here.</p>
            )}
          </section>
        );
      })}
    </div>
  ) : (
    <div className="board">
      {scopeDescriptionBlock}
      <section
        className={clsx("drop-zone", activeDropZone === projectPlacement(targetProjectId) && "drop-active")}
        onDragEnter={markDropZone(targetProjectId, null)}
        onDragOver={markDropZone(targetProjectId, null)}
        onDragLeave={() => clearDropZone()}
        onDrop={moveDroppedTask(targetProjectId, null)}
        aria-label={`${taskTargetLabel} tasks`}
      >
        <div className="task-scope-heading project-task-scope-heading">
          <button
            type="button"
            className="scope-add-task-button"
            aria-label={`Add task to ${taskTargetLabel}`}
            onClick={() =>
              openAddTaskDialog(projectPlacement(targetProjectId), projectRootTasks[0]?.id ?? null)
            }
          >
            <Plus size={16} aria-hidden="true" />
            Add task
          </button>
        </div>
        {projectRootTasks.length > 0 ? (
          <>
            {renderTaskNodes(projectRootTasks, taskActions)}
            <button
              type="button"
              className="scope-add-task-button"
              aria-label={`Add task to bottom of ${taskTargetLabel}`}
              onClick={() => openAddTaskDialog(projectPlacement(targetProjectId))}
            >
              <Plus size={14} aria-hidden="true" />
              Add task
            </button>
          </>
        ) : (
          <p className="empty">No project tasks yet.</p>
        )}
      </section>
      <div className="section-create-block">
        {addingSection ? (
          <form
            className="inline-create-form"
            onSubmit={submitSection}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelSectionCreate();
              }
            }}
          >
            <label htmlFor="section-title">Title</label>
            <input
              ref={sectionCreateInputRef}
              id="section-title"
              aria-label="Section title"
              value={sectionTitle}
              onChange={(event) => setSectionTitle(event.target.value)}
            />
            <div>
              <button type="submit" className="btn-primary">
                Save
              </button>
              <button type="button" onClick={cancelSectionCreate}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="add-section-trigger"
            onClick={() => {
              setSectionTitle("");
              setAddingSection(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Add section
          </button>
        )}
      </div>
      {projectSections.map((section) => {
        const sectionTasks = allTasks.filter(
          (task) => task.projectId === targetProjectId && task.sectionId === section.id,
        );
        return (
          <section
            key={section.id}
            className={clsx("drop-zone", activeDropZone === sectionPlacement(section.id) && "drop-active")}
            onDragEnter={markDropZone(targetProjectId, section.id)}
            onDragOver={markDropZone(targetProjectId, section.id)}
            onDragLeave={() => clearDropZone()}
            onDrop={moveDroppedTask(targetProjectId, section.id)}
            aria-label={`Section ${section.title}`}
          >
            <div
              className={clsx(
                "section-header",
                draggingSectionId === section.id && "section-dragging",
                activeSectionDrop?.id === section.id && `section-drop-${activeSectionDrop.position}`,
              )}
              draggable={editSectionId !== section.id}
              onDragStart={startSectionDrag(section)}
              onDragEnd={() => {
                setDraggingSectionId(null);
                setActiveSectionDrop(null);
              }}
              onDragEnter={markSectionDrop(section)}
              onDragOver={markSectionDrop(section)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setActiveSectionDrop(null);
              }}
              onDrop={dropSection(section, projectSections)}
            >
              {editSectionId === section.id ? (
                <form
                  className="section-edit-form"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditSectionId(null);
                      setEditSectionTitle("");
                    }
                  }}
                  onSubmit={submitSectionEdit(section)}
                >
                  <label htmlFor={`section-edit-${section.id}`}>Section title</label>
                  <input
                    id={`section-edit-${section.id}`}
                    autoFocus
                    value={editSectionTitle}
                    onChange={(event) => setEditSectionTitle(event.target.value)}
                  />
                  <button type="submit">Save section</button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditSectionId(null);
                      setEditSectionTitle("");
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <h2>{section.title}</h2>
                  <div className="section-actions">
                    <button
                      type="button"
                      aria-label={`Edit section ${section.title}`}
                      onClick={() => startSectionEdit(section)}
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Delete section ${section.title}`}
                      onClick={() => requestSectionDelete(section)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
            {editSectionId !== section.id ? (
              <button
                type="button"
                className="scope-add-task-button"
                aria-label={`Add task to section ${section.title}`}
                onClick={() => openAddTaskDialog(sectionPlacement(section.id), sectionTasks[0]?.id ?? null)}
              >
                <Plus size={16} aria-hidden="true" />
                Add task
              </button>
            ) : null}
            {sectionTasks.length > 0 ? (
              <>
                {renderTaskNodes(sectionTasks, taskActions)}
                <button
                  type="button"
                  className="scope-add-task-button"
                  aria-label={`Add task to bottom of section ${section.title}`}
                  onClick={() => openAddTaskDialog(sectionPlacement(section.id))}
                >
                  <Plus size={14} aria-hidden="true" />
                  Add task
                </button>
              </>
            ) : (
              <p className="empty">Drop project tasks here.</p>
            )}
          </section>
        );
      })}
    </div>
  );
};
