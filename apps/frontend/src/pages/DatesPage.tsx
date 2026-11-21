import type { Task, TaskNode } from "@todoist-clone/domain";
import type { Dispatch, SetStateAction } from "react";
import { CalendarPanel, type CalendarPanelProps } from "../components/CalendarPanel";
import { calendarWeekdays } from "../components/TaskFormFields";
import { renderTaskNodes } from "../components/TaskTreeView";

/**
 * Calendar screen data and handlers for selecting, moving, and opening tasks.
 *
 * @typedef {Object} DatesPageProps
 * @property {"list" | "calendar"} dateView - Whether dates are shown as a calendar or a list.
 * @property {Dispatch<SetStateAction<"list" | "calendar">>} setDateView - Changes the dates page view.
 * @property {"all" | "overdue" | "today" | "upcoming"} dateListFilter - Task filter for the dates page.
 * @property {Dispatch<SetStateAction<"all" | "overdue" | "today" | "upcoming">>} setDateListFilter - Changes the dates page task filter.
 * @property {string} calendarMonth - Month displayed in the calendar.
 * @property {string} calendarLabel - Month and year label in the calendar heading.
 * @property {CalendarPanelProps["days"]} calendarDays - Grid cells for the selected month.
 * @property {Array<Task>} calendarTasks - Tasks displayed in the calendar view.
 * @property {number} calendarTaskCount - Number of tasks displayed in the calendar.
 * @property {string | null} activeCalendarDate - Selected calendar date.
 * @property calendarTaskLocation - Determines a task's position in the calendar list.
 * @property {Dispatch<SetStateAction<string>>} setCalendarMonth - Selects the calendar month.
 * @property shiftCalendarMonth - Moves the calendar to an adjacent month.
 * @property onToday - Selects today's date.
 * @property {CalendarPanelProps["onMarkDate"]} onMarkDate - Marks a date in the calendar.
 * @property {CalendarPanelProps["onDropDate"]} onDropDate - Handles dropping a task on a date.
 * @property onLeaveDate - Handles ending a drag over a date.
 * @property {CalendarPanelProps["onTaskDragStart"]} onTaskDragStart - Starts dragging a task from the calendar.
 * @property {CalendarPanelProps["onTaskDragEnd"]} onTaskDragEnd - Ends dragging a task in the calendar.
 * @property {CalendarPanelProps["onTaskOpen"]} onTaskOpen - Opens task details.
 * @property {Array<TaskNode>} viewTasks - Tasks currently displayed.
 * @property {Parameters<typeof renderTaskNodes>[1]} taskActions - Actions available for task nodes.
 */
export type DatesPageProps = {
  dateView: "list" | "calendar";

  setDateView: Dispatch<SetStateAction<"list" | "calendar">>;

  dateListFilter: "all" | "overdue" | "today" | "upcoming";

  setDateListFilter: Dispatch<SetStateAction<"all" | "overdue" | "today" | "upcoming">>;

  calendarMonth: string;

  calendarLabel: string;

  calendarDays: CalendarPanelProps["days"];

  calendarTasks: Array<Task>;

  calendarTaskCount: number;

  activeCalendarDate: string | null;

  calendarTaskLocation: (task: Task) => string;

  setCalendarMonth: Dispatch<SetStateAction<string>>;

  shiftCalendarMonth: (amount: number) => void;

  onToday: () => void;

  onMarkDate: CalendarPanelProps["onMarkDate"];

  onDropDate: CalendarPanelProps["onDropDate"];

  onLeaveDate: () => void;

  onTaskDragStart: CalendarPanelProps["onTaskDragStart"];

  onTaskDragEnd: CalendarPanelProps["onTaskDragEnd"];

  onTaskOpen: CalendarPanelProps["onTaskOpen"];

  viewTasks: Array<TaskNode>;

  taskActions: Parameters<typeof renderTaskNodes>[1];
};

/**
 * Shows a calendar or a filtered list of tasks with due dates.
 *
 * @param {DatesPageProps} parameter1
 */
export const DatesPage = ({
  dateView,
  setDateView,
  dateListFilter,
  setDateListFilter,
  calendarMonth,
  calendarLabel,
  calendarDays,
  calendarTasks,
  calendarTaskCount,
  activeCalendarDate,
  calendarTaskLocation,
  setCalendarMonth,
  shiftCalendarMonth,
  onToday,
  onMarkDate,
  onDropDate,
  onLeaveDate,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskOpen,
  viewTasks,
  taskActions,
}: DatesPageProps) => (
  <section className="drop-zone task-filter-page" aria-label="Dates tasks">
    <div className="date-view-switch" aria-label="Date view">
      <button type="button" aria-pressed={dateView === "list"} onClick={() => setDateView("list")}>
        List
      </button>
      <button type="button" aria-pressed={dateView === "calendar"} onClick={() => setDateView("calendar")}>
        Calendar
      </button>
    </div>
    {dateView === "list" ? (
      <nav className="date-list-filter" aria-label="Filter dated tasks">
        {(
          [
            { id: "all", label: "All" },
            { id: "overdue", label: "Overdue" },
            { id: "today", label: "Today" },
            { id: "upcoming", label: "Upcoming" },
          ] as const
        ).map((filter) => (
          <button
            type="button"
            key={filter.id}
            aria-pressed={dateListFilter === filter.id}
            onClick={() => setDateListFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </nav>
    ) : null}
    {dateView === "calendar" ? (
      <CalendarPanel
        month={calendarMonth}
        label={calendarLabel}
        days={calendarDays}
        weekdays={calendarWeekdays}
        tasks={calendarTasks}
        taskCount={calendarTaskCount}
        activeDate={activeCalendarDate}
        locationForTask={calendarTaskLocation}
        onMonthChange={setCalendarMonth}
        onShiftMonth={shiftCalendarMonth}
        onToday={onToday}
        onMarkDate={onMarkDate}
        onDropDate={onDropDate}
        onLeaveDate={onLeaveDate}
        onTaskDragStart={onTaskDragStart}
        onTaskDragEnd={onTaskDragEnd}
        onTaskOpen={onTaskOpen}
      />
    ) : viewTasks.length > 0 ? (
      renderTaskNodes(viewTasks, taskActions)
    ) : (
      <p className="empty">
        {dateListFilter === "all"
          ? "No dated tasks yet."
          : dateListFilter === "today"
            ? "No tasks due today."
            : `No ${dateListFilter} tasks.`}
      </p>
    )}
  </section>
);
