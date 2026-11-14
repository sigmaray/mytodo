import type { Task } from "@todoist-clone/domain";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DragEvent } from "react";

/** День календарной сетки и признаки его визуального состояния. */
type CalendarDay = {
  /** ISO-дата ячейки. */
  date: string;
  /** Число месяца для подписи ячейки. */
  day: number;
  /** Входит ли дата в отображаемый месяц. */
  isCurrentMonth: boolean;
  /** Является ли дата текущим днём. */
  isToday: boolean;
  /** Попадает ли день на выходные. */
  isWeekend: boolean;
};

/** Данные календарной сетки и обработчики навигации, выбора и drag-and-drop. */
export type CalendarPanelProps = {
  /** Месяц в формате `YYYY-MM`. */
  month: string;
  /** Текстовая подпись месяца. */
  label: string;
  /** Ячейки календаря. */
  days: Array<CalendarDay>;
  /** Подписи столбцов дней недели. */
  weekdays: Array<string>;
  /** Задачи, сроки которых показаны в календаре. */
  tasks: Array<Task>;
  /** Количество задач в активном представлении. */
  taskCount: number;
  /** Дата выбранной или наведённой ячейки. */
  activeDate: string | null;
  /** Формирует подпись места задачи рядом с её названием. */
  locationForTask: (task: Task) => string;
  /** Выбирает месяц из поля календаря. */
  onMonthChange: (month: string) => void;
  /** Сдвигает календарь на заданное число месяцев. */
  onShiftMonth: (amount: number) => void;
  /** Переключает календарь на текущий месяц. */
  onToday: () => void;
  /** Запускает изменение срока задачи для даты. */
  onMarkDate: (date: string) => (event: DragEvent<HTMLElement>) => void;
  /** Принимает перетащенную задачу на календарную дату. */
  onDropDate: (date: string) => (event: DragEvent<HTMLElement>) => void;
  /** Сбрасывает активную календарную дату. */
  onLeaveDate: () => void;
  /** Начинает перетаскивание задачи из календаря. */
  onTaskDragStart: (task: Task, event: DragEvent<HTMLButtonElement>) => void;
  /** Завершает перетаскивание задачи из календаря. */
  onTaskDragEnd: () => void;
  /** Открывает задачу из календаря. */
  onTaskOpen: (task: Task) => void;
};

/** Отрисовывает календарную сетку, сроки задач и список выбранного дня. */
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
              // Пустой ввод month не заменяет последнее валидное отображение календаря.
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
                  // Не сбрасываем подсветку, пока указатель перемещается между дочерними элементами ячейки.
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
