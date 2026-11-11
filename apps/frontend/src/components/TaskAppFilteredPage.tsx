import type { Task, TaskNode } from "@todoist-clone/domain";
import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { CalendarPanel, type CalendarPanelProps } from "./CalendarPanel";
import { calendarWeekdays } from "./TaskFormFields";
import { renderTaskNodes } from "./TaskTreeView";

type TaskAppFilteredPageProps = Readonly<{
  mode: "dates" | "labels";
  viewTitle: string;
  dateView: "list" | "calendar";
  setDateView: Dispatch<SetStateAction<"list" | "calendar">>;
  dateListFilter: "all" | "overdue" | "today" | "upcoming";
  setDateListFilter: Dispatch<SetStateAction<"all" | "overdue" | "today" | "upcoming">>;
  selectedLabel: string;
  flatTasks: ReadonlyArray<Task>;
  calendarMonth: string;
  calendarLabel: string;
  calendarDays: CalendarPanelProps["days"];
  calendarTasks: ReadonlyArray<Task>;
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
  viewTasks: ReadonlyArray<TaskNode>;
  taskActions: Parameters<typeof renderTaskNodes>[1];
}>;

export const TaskAppFilteredPage = ({
  mode,
  viewTitle,
  dateView,
  setDateView,
  dateListFilter,
  setDateListFilter,
  selectedLabel,
  flatTasks,
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
}: TaskAppFilteredPageProps) => (
  <section className="drop-zone task-filter-page" aria-label={`${viewTitle} tasks`}>
    {mode === "dates" ? (
      <div className="date-view-switch" aria-label="Date view">
        <button type="button" aria-pressed={dateView === "list"} onClick={() => setDateView("list")}>
          List
        </button>
        <button type="button" aria-pressed={dateView === "calendar"} onClick={() => setDateView("calendar")}>
          Calendar
        </button>
      </div>
    ) : null}
    {mode === "dates" && dateView === "list" ? (
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
    {mode === "labels" ? (
      <nav className="label-filter-list" aria-label="Filter by label">
        <Link className={!selectedLabel ? "active" : ""} to="/labels">
          All labels
        </Link>
        {Array.from(new Set(flatTasks.flatMap((task) => task.labels)))
          .sort()
          .map((label) => (
            <Link
              key={label}
              className={selectedLabel === label ? "active" : ""}
              to={`/labels?label=${encodeURIComponent(label)}`}
            >
              {label}
            </Link>
          ))}
      </nav>
    ) : null}
    {mode === "dates" && dateView === "calendar" ? (
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
        {mode === "dates"
          ? dateListFilter === "all"
            ? "No dated tasks yet."
            : dateListFilter === "today"
              ? "No tasks due today."
              : `No ${dateListFilter} tasks.`
          : "No tasks with this label."}
      </p>
    )}
  </section>
);
