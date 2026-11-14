import type { Task, TaskNode } from "@todoist-clone/domain";
import type { Dispatch, SetStateAction } from "react";
import { CalendarPanel, type CalendarPanelProps } from "../components/CalendarPanel";
import { calendarWeekdays } from "../components/TaskFormFields";
import { renderTaskNodes } from "../components/TaskTreeView";

/**
 * @callback DatesPagePropsCalendarTaskLocation
 * @param {Task} task
 * @returns {string}
 */

/**
 * @callback DatesPagePropsShiftCalendarMonth
 * @param {number} amount
 * @returns {void}
 */

/**
 * @callback DatesPagePropsOnToday
 * @returns {void}
 */

/**
 * @callback DatesPagePropsOnLeaveDate
 * @returns {void}
 */
/**
 * Данные календарного экрана и обработчики выбора, перемещения и открытия задач.
 *
 * @typedef {Object} DatesPageProps
 * @property {"list" | "calendar"} dateView - Режим отображения календаря или списка дат.
 * @property {Dispatch<SetStateAction<"list" | "calendar">>} setDateView - Меняет режим отображения страницы дат.
 * @property {"all" | "overdue" | "today" | "upcoming"} dateListFilter - Фильтр задач на странице дат.
 * @property {Dispatch<SetStateAction<"all" | "overdue" | "today" | "upcoming">>} setDateListFilter - Меняет фильтр задач на странице дат.
 * @property {string} calendarMonth - Месяц, отображаемый в календаре.
 * @property {string} calendarLabel - Подпись месяца и года в заголовке календаря.
 * @property {CalendarPanelProps["days"]} calendarDays - Ячейки календарной сетки выбранного месяца.
 * @property {Array<Task>} calendarTasks - Задачи, показанные в календарном представлении.
 * @property {number} calendarTaskCount - Количество задач в календарном представлении.
 * @property {string | null} activeCalendarDate - Выбранная дата календаря.
 * @property {DatesPagePropsCalendarTaskLocation} calendarTaskLocation - Определяет место задачи в календарном списке.
 * @property {Dispatch<SetStateAction<string>>} setCalendarMonth - Выбирает месяц для календаря.
 * @property {DatesPagePropsShiftCalendarMonth} shiftCalendarMonth - Переключает календарь на соседний месяц.
 * @property {DatesPagePropsOnToday} onToday - Выбирает текущую дату.
 * @property {CalendarPanelProps["onMarkDate"]} onMarkDate - Помечает дату в календаре.
 * @property {CalendarPanelProps["onDropDate"]} onDropDate - Обрабатывает перенос задачи на дату.
 * @property {DatesPagePropsOnLeaveDate} onLeaveDate - Обрабатывает завершение перетаскивания над датой.
 * @property {CalendarPanelProps["onTaskDragStart"]} onTaskDragStart - Начинает перетаскивание задачи из календаря.
 * @property {CalendarPanelProps["onTaskDragEnd"]} onTaskDragEnd - Завершает перетаскивание задачи в календаре.
 * @property {CalendarPanelProps["onTaskOpen"]} onTaskOpen - Открывает подробности задачи.
 * @property {Array<TaskNode>} viewTasks - Список задач, относящихся к отображаемые.
 * @property {Parameters<typeof renderTaskNodes>[1]} taskActions - Данные «задача действия», используемые типом «DatesPageProps».
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
 * Показывает календарь либо отфильтрованный список задач со сроками.
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
