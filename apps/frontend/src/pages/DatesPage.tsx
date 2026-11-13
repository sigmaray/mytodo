import type { Task, TaskNode } from "@todoist-clone/domain";
import type { Dispatch, SetStateAction } from "react";
import { CalendarPanel, type CalendarPanelProps } from "../components/CalendarPanel";
import { calendarWeekdays } from "../components/TaskFormFields";
import { renderTaskNodes } from "../components/TaskTreeView";

export type DatesPageProps = Readonly<{
  dateView: "list" | "calendar";
  setDateView: Dispatch<SetStateAction<"list" | "calendar">>;
  dateListFilter: "all" | "overdue" | "today" | "upcoming";
  setDateListFilter: Dispatch<SetStateAction<"all" | "overdue" | "today" | "upcoming">>;
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
