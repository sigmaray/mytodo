import type { Task } from "@todoist-clone/domain";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DragEvent } from "react";

/**
 * День календарной сетки и признаки его визуального состояния.
 *
 * @typedef {Object} CalendarDay
 * @property {string} date - Дата календарного дня.
 * @property {number} day - Номер дня месяца.
 * @property {boolean} isCurrentMonth - Признак: is текущие месяц.
 * @property {boolean} isToday - Признак: is today.
 * @property {boolean} isWeekend - Признак: is weekend.
 */
type CalendarDay = {
  date: string;

  day: number;

  isCurrentMonth: boolean;

  isToday: boolean;

  isWeekend: boolean;
};

/**
 * @callback CalendarPanelPropsLocationForTask
 * @param {Task} task
 * @returns {string}
 */

/**
 * @callback CalendarPanelPropsOnMonthChange
 * @param {string} month
 * @returns {void}
 */

/**
 * @callback CalendarPanelPropsOnShiftMonth
 * @param {number} amount
 * @returns {void}
 */

/**
 * @callback CalendarPanelPropsOnToday
 * @returns {void}
 */

/**
 * @callback CalendarPanelPropsOnMarkDate
 * @param {string} date
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * @callback CalendarPanelPropsOnDropDate
 * @param {string} date
 * @returns {(event: DragEvent<HTMLElement>) => void}
 */

/**
 * @callback CalendarPanelPropsOnLeaveDate
 * @returns {void}
 */

/**
 * @callback CalendarPanelPropsOnTaskDragStart
 * @param {Task} task
 * @param {DragEvent<HTMLButtonElement>} event
 * @returns {void}
 */

/**
 * @callback CalendarPanelPropsOnTaskDragEnd
 * @returns {void}
 */

/**
 * @callback CalendarPanelPropsOnTaskOpen
 * @param {Task} task
 * @returns {void}
 */
/**
 * Данные календарной сетки и обработчики навигации, выбора и drag-and-drop.
 *
 * @typedef {Object} CalendarPanelProps
 * @property {string} month - Месяц календаря.
 * @property {string} label - Данные «метка», используемые типом «CalendarPanelProps».
 * @property {Array<CalendarDay>} days - Ячейки календарной сетки.
 * @property {Array<string>} weekdays - Краткие названия дней недели.
 * @property {Array<Task>} tasks - Список задачи.
 * @property {number} taskCount - Количество задач.
 * @property {string | null} activeDate - Дата, выбранная в календаре.
 * @property {CalendarPanelPropsLocationForTask} locationForTask - Определяет положение задачи в списке.
 * @property {CalendarPanelPropsOnMonthChange} onMonthChange - Обрабатывает выбор другого месяца.
 * @property {CalendarPanelPropsOnShiftMonth} onShiftMonth - Переключает календарь на соседний месяц.
 * @property {CalendarPanelPropsOnToday} onToday - Выбирает текущую дату.
 * @property {CalendarPanelPropsOnMarkDate} onMarkDate - Помечает дату в календаре.
 * @property {CalendarPanelPropsOnDropDate} onDropDate - Обрабатывает перенос задачи на дату.
 * @property {CalendarPanelPropsOnLeaveDate} onLeaveDate - Обрабатывает завершение перетаскивания над датой.
 * @property {CalendarPanelPropsOnTaskDragStart} onTaskDragStart - Начинает перетаскивание задачи.
 * @property {CalendarPanelPropsOnTaskDragEnd} onTaskDragEnd - Завершает перетаскивание задачи.
 * @property {CalendarPanelPropsOnTaskOpen} onTaskOpen - Открывает подробности задачи.
 */
export type CalendarPanelProps = {
  month: string;

  label: string;

  days: Array<CalendarDay>;

  weekdays: Array<string>;

  tasks: Array<Task>;

  taskCount: number;

  activeDate: string | null;

  locationForTask: (task: Task) => string;

  onMonthChange: (month: string) => void;

  onShiftMonth: (amount: number) => void;

  onToday: () => void;

  onMarkDate: (date: string) => (event: DragEvent<HTMLElement>) => void;

  onDropDate: (date: string) => (event: DragEvent<HTMLElement>) => void;

  onLeaveDate: () => void;

  onTaskDragStart: (task: Task, event: DragEvent<HTMLButtonElement>) => void;

  onTaskDragEnd: () => void;

  onTaskOpen: (task: Task) => void;
};

/**
 * Отрисовывает календарную сетку, сроки задач и список выбранного дня.
 *
 * @param {CalendarPanelProps} parameter1
 */
export const CalendarPanel = ({
  month,
  label,
  days,
  weekdays,
  tasks,
  taskCount,
  activeDate,
  locationForTask,
  onMonthChange,
  onShiftMonth,
  onToday,
  onMarkDate,
  onDropDate,
  onLeaveDate,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskOpen,
}: CalendarPanelProps) => (
  <section className="calendar-panel" aria-labelledby="calendar-month-heading">
    <header className="calendar-month-control">
      <div className="calendar-month-navigation">
        <button type="button" aria-label="Previous month" onClick={() => onShiftMonth(-1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 id="calendar-month-heading">{label}</h2>
        <button type="button" aria-label="Next month" onClick={() => onShiftMonth(1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="calendar-month-summary">
        {taskCount} {taskCount === 1 ? "task" : "tasks"}
      </p>
      <div className="calendar-month-actions">
        <button type="button" className="calendar-today-button" onClick={onToday}>
          Today
        </button>
        <label className="calendar-month-picker">
          <span>Choose month</span>
          <input
            aria-label="Calendar month"
            type="month"
            value={month}
            onChange={(event) => {
              /** Пустой ввод month не заменяет последнее валидное отображение календаря. */
              if (event.target.value) onMonthChange(event.target.value);
            }}
          />
        </label>
      </div>
    </header>
    <div className="dates-calendar-scroll">
      <div className="dates-calendar-frame">
        <div className="dates-calendar-weekdays" role="row">
          {weekdays.map((weekday, index) => (
            <div key={weekday} role="columnheader" className={index > 4 ? "weekend" : undefined}>
              {weekday}
            </div>
          ))}
        </div>
        <div className="dates-calendar" role="grid" aria-label="Calendar view">
          {days.map((day) => {
            const matching = tasks.filter((task) => task.dueDate === day.date);
            return (
              <section
                key={day.date}
                role="gridcell"
                className={clsx(
                  "dates-calendar-day",
                  !day.isCurrentMonth && "outside-month",
                  day.isWeekend && "weekend",
                  day.isToday && "today",
                  activeDate === day.date && "calendar-drop-active",
                )}
                aria-label={`Tasks for ${day.date}`}
                onDragOver={onMarkDate(day.date)}
                onDragLeave={(event) => {
                  /** Не сбрасываем подсветку, пока указатель перемещается между дочерними элементами ячейки. */
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeaveDate();
                }}
                onDrop={onDropDate(day.date)}
              >
                <header className="calendar-day-header">
                  <time dateTime={day.date} aria-current={day.isToday ? "date" : undefined}>
                    {day.day}
                  </time>
                  {matching.length > 0 ? (
                    <span aria-label={`${matching.length} ${matching.length === 1 ? "task" : "tasks"}`}>
                      {matching.length}
                    </span>
                  ) : null}
                </header>
                <div className="calendar-day-tasks">
                  {matching.map((task) => (
                    <button
                      type="button"
                      className="calendar-task-card"
                      aria-label={task.title}
                      title={`${task.title} · ${locationForTask(task)}`}
                      key={task.id}
                      draggable
                      onDragStart={(event) => onTaskDragStart(task, event)}
                      onDragEnd={onTaskDragEnd}
                      onClick={() => onTaskOpen(task)}
                    >
                      <span>{task.title}</span>
                      <small>{locationForTask(task)}</small>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);
