import type { Task, TaskNode } from "@todoist-clone/domain";
import type { Dispatch, SetStateAction } from "react";
import { CalendarPanel, type CalendarPanelProps } from "../components/CalendarPanel";
import { calendarWeekdays } from "../components/TaskFormFields";
import { renderTaskNodes } from "../components/TaskTreeView";

/** Данные календарного экрана и обработчики выбора, перемещения и открытия задач. */
export type DatesPageProps = {
  /** Активный режим списка или календаря. */
  dateView: "list" | "calendar";
  /** Переключает режим просмотра дат. */
  setDateView: Dispatch<SetStateAction<"list" | "calendar">>;
  /** Фильтр списка задач по сроку. */
  dateListFilter: "all" | "overdue" | "today" | "upcoming";
  /** Обновляет фильтр задач по сроку. */
  setDateListFilter: Dispatch<SetStateAction<"all" | "overdue" | "today" | "upcoming">>;
  /** Месяц календаря в формате `YYYY-MM`. */
  calendarMonth: string;
  /** Локализованный заголовок текущего месяца. */
  calendarLabel: string;
  /** Ячейки календарной сетки. */
  calendarDays: CalendarPanelProps["days"];
  /** Задачи, связанные с текущим месяцем или выбранным днём. */
  calendarTasks: Array<Task>;
  /** Количество задач, показанное возле заголовка календаря. */
  calendarTaskCount: number;
  /** Дата, над которой находится курсор или для которой открыт список задач. */
  activeCalendarDate: string | null;
  /** Возвращает подпись места размещения задачи. */
  calendarTaskLocation: (task: Task) => string;
  /** Меняет месяц календаря. */
  setCalendarMonth: Dispatch<SetStateAction<string>>;
  /** Сдвигает календарь на заданное количество месяцев. */
  shiftCalendarMonth: (amount: number) => void;
  /** Возвращает календарь к текущему месяцу. */
  onToday: () => void;
  /** Устанавливает дату задачи на выбранный календарный день. */
  onMarkDate: CalendarPanelProps["onMarkDate"];
  /** Перемещает задачу на выбранный день. */
  onDropDate: CalendarPanelProps["onDropDate"];
  /** Закрывает список задач активного дня. */
  onLeaveDate: () => void;
  /** Начинает перетаскивание задачи из календаря. */
  onTaskDragStart: CalendarPanelProps["onTaskDragStart"];
  /** Завершает перетаскивание задачи из календаря. */
  onTaskDragEnd: CalendarPanelProps["onTaskDragEnd"];
  /** Открывает выбранную задачу. */
  onTaskOpen: CalendarPanelProps["onTaskOpen"];
  /** Иерархия задач для представления списка дат. */
  viewTasks: Array<TaskNode>;
  /** Действия над строками задач. */
  taskActions: Parameters<typeof renderTaskNodes>[1];
};

/** Показывает календарь либо отфильтрованный список задач со сроками. */
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
