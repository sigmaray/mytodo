import clsx from "clsx";
import { Tag, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toLocalIsoDate } from "../dateUtils";

/** Параметры textarea, автоматически подстраивающей высоту под содержимое. */
export type AutoGrowTextareaProps = {
  /** Текст, отображаемый в поле. */
  value: string;
  /** Передаёт новое значение форме-владельцу. */
  onChange: (value: string) => void;
  /** Доступное имя поля для вспомогательных технологий. */
  ariaLabel: string;
  /** DOM ID поля для связи с подписью. */
  id?: string;
  /** Подсказка, отображаемая до ввода текста. */
  placeholder?: string;
  /** Переводит фокус в поле после монтирования. */
  autoFocus?: boolean;
  /** Делает поле обязательным в нативной форме. */
  required?: boolean;
  /** Дополнительные CSS-классы. */
  className?: string;
  /** Обработчик клавиатурных событий textarea. */
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Обработчик вставки содержимого из буфера обмена. */
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
};

/** Отрисовывает textarea, высота которой следует за размером введённого текста. */
export const AutoGrowTextarea = ({
  value,
  onChange,
  ariaLabel,
  id,
  placeholder,
  autoFocus,
  required,
  className,
  onKeyDown,
  onPaste,
}: AutoGrowTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Перед измерением сбрасываем прежнюю высоту, чтобы поле могло уменьшиться вместе с текстом.
  const resize = () => {
    const textarea = textareaRef.current;
    if (textarea === null) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  useEffect(resize, [value]);
  useLayoutEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);
  return (
    <textarea
      ref={textareaRef}
      id={id}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      required={required}
      className={className}
      placeholder={placeholder}
      rows={1}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
        resize();
      }}
      onInput={resize}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
};

/** Входные данные и обработчики выбора меток. */
type LabelPickerProps = {
  /** Уже выбранные метки. */
  selected: Array<string>;
  /** Известные приложению метки для подсказок. */
  options: Array<string>;
  /** Доступное имя текстового поля. */
  inputLabel: string;
  /** Текущий текст поиска или новой метки. */
  inputValue: string;
  /** Обновляет значение текстового поля. */
  onInputChange: (value: string) => void;
  /** Сохраняет новый массив выбранных меток. */
  onChange: (labels: Array<string>) => void | Promise<unknown>;
  /** Фокусирует поле сразу после показа компонента. */
  autoFocus?: boolean;
};

/** Удаляет пробелы по краям и дубли меток без учёта регистра. */
export const normalizeLabels = (labels: Array<string>): Array<string> =>
  labels.reduce<Array<string>>((result, label) => {
    const normalized = label.trim();
    return normalized && !result.some((item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase())
      ? [...result, normalized]
      : result;
  }, []);

/** Позволяет редактировать метки и откатывает локальное изменение при ошибке сохранения. */
export const LabelPicker = ({
  selected,
  options,
  inputLabel,
  inputValue,
  onInputChange,
  onChange,
  autoFocus = false,
}: LabelPickerProps) => {
  const [focused, setFocused] = useState(false);
  const [current, setCurrent] = useState<Array<string>>(selected);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setCurrent(selected), [selected]);
  useLayoutEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  // Обновление показывается сразу, но при ошибке API выбор восстанавливается.
  const commit = async (labels: Array<string>) => {
    // Нормализация исключает пустые и регистронезависимые дубли до записи.
    const next = normalizeLabels(labels);
    setCurrent(next);
    try {
      await onChange(next);
    } catch {
      // Если API отказал, восстанавливаем последнее подтверждённое значение props.
      setCurrent(selected);
    }
  };
  const addLabel = async (label: string) => {
    // Очищаем поле и подсказки сразу, а запрос отправляем только для новой метки.
    const next = normalizeLabels([...current, label]);
    onInputChange("");
    setFocused(false);
    if (next.length !== current.length) await commit(next);
  };
  const suggestions = normalizeLabels(options)
    .filter((label) => !current.some((item) => item.toLocaleLowerCase() === label.toLocaleLowerCase()))
    .filter(
      (label) =>
        !inputValue.trim() || label.toLocaleLowerCase().includes(inputValue.trim().toLocaleLowerCase()),
    )
    .slice(0, 8);
  const updateInput = (value: string) => {
    if (!value.includes(",")) {
      onInputChange(value);
      return;
    }
    // Запятая завершает одну или несколько меток; последний фрагмент остаётся черновиком.
    const pieces = value.split(",");
    const next = normalizeLabels([...current, ...pieces.slice(0, -1)]);
    if (next.length !== current.length) void commit(next);
    onInputChange(pieces.at(-1) ?? "");
  };
  return (
    <div className="label-picker">
      <div
        className="label-picker-control"
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        {current.map((label) => (
          <span className="label-picker-chip" key={label}>
            <Tag size={13} aria-hidden="true" />
            {label}
            <button
              type="button"
              aria-label={`Remove label ${label}`}
              onClick={() => void commit(current.filter((item) => item !== label))}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          aria-label={inputLabel}
          value={inputValue}
          placeholder={current.length ? "Add another label" : "Type a label"}
          onClick={() => setFocused(true)}
          onChange={(event) => {
            setFocused(true);
            updateInput(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (inputValue.trim()) void addLabel(inputValue);
            }
            if (event.key === "Backspace" && !inputValue && current.length) void commit(current.slice(0, -1));
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onInputChange("");
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      {focused && suggestions.length > 0 ? (
        <div className="label-picker-suggestions" role="listbox" aria-label="Suggested labels">
          {suggestions.map((label) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void addLabel(label)}
            >
              <Tag size={14} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <small>Press Enter to add a label. Use Backspace to remove the last one.</small>
    </div>
  );
};

/** День и признаки его положения для ячейки календарной сетки. */
type CalendarDay = {
  /** ISO-дата, используемая для выбора дня. */
  date: string;
  /** Номер календарного дня. */
  day: number;
  /** Находится ли дата в отображаемом месяце. */
  isCurrentMonth: boolean;
  /** Совпадает ли дата с сегодняшним локальным днём. */
  isToday: boolean;
  /** Попадает ли дата на субботу или воскресенье. */
  isWeekend: boolean;
};

/** Краткие подписи календарной сетки, начиная с понедельника. */
export const calendarWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Преобразует ISO-месяц `YYYY-MM` в числовые компоненты. */
const calendarMonthParts = (month: string) => ({
  year: Number(month.slice(0, 4)),
  monthIndex: Number(month.slice(5, 7)) - 1,
});

/** Форматирует UTC дату как ISO-строку календарного дня. */
const isoDateFromUtc = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

/** Сдвигает месяц вперёд или назад на указанное число месяцев. */
export const shiftCalendarMonth = (month: string, amount: number) => {
  const { year, monthIndex } = calendarMonthParts(month);
  const shifted = new Date(Date.UTC(year, monthIndex + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Формирует локализованную подпись месяца для календарного заголовка. */
export const calendarMonthLabel = (month: string) => {
  const { year, monthIndex } = calendarMonthParts(month);
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

/** Создаёт сетку из шести недель и дополняет месяц днями соседних месяцев. */
export const buildCalendarDays = (month: string): Array<CalendarDay> => {
  const { year, monthIndex } = calendarMonthParts(month);
  // Смещаем первую колонку на понедельник, а даты считаем в UTC без локального DST-сдвига.
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const today = toLocalIsoDate(new Date());
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(Date.UTC(year, monthIndex, index - mondayOffset + 1));
    const date = isoDateFromUtc(current);
    const weekday = current.getUTCDay();
    return {
      date,
      day: current.getUTCDate(),
      isCurrentMonth: current.getUTCMonth() === monthIndex,
      isToday: date === today,
      isWeekend: weekday === 0 || weekday === 6,
    };
  });
};

/** Преобразует быстрый выбор даты в ISO-дату для поля срока задачи. */
const getDateShortcut = (shortcut: "Today" | "Tomorrow" | "This weekend" | "Next week") => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (shortcut === "Tomorrow") date.setDate(date.getDate() + 1);
  if (shortcut === "This weekend") date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7));
  if (shortcut === "Next week") date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  return toLocalIsoDate(date);
};

/** Показывает быстрые варианты срока и календарь для выбора даты задачи. */
export const DatePickerPanel = ({
  value,
  onChange,
  inputLabel,
  autoFocus = false,
}: {
  /** Выбранный срок в ISO-формате или пустая строка. */
  value: string;
  /** Передаёт новую дату владельцу формы. */
  onChange: (value: string) => void;
  /** Доступное имя поля выбора даты. */
  inputLabel: string;
  /** Переводит фокус на поле сразу после показа панели. */
  autoFocus?: boolean;
}) => {
  const [month, setMonth] = useState(() => (value || getDateShortcut("Today")).slice(0, 7));
  const today = toLocalIsoDate(new Date());
  useEffect(() => {
    // При внешнем изменении срока показываем месяц выбранной даты.
    if (value) setMonth(value.slice(0, 7));
  }, [value]);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const monthDate = new Date(Date.UTC(year, monthNumber - 1, 1));
  const monthLabel = monthDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const firstDayOffset = (monthDate.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cellCount = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
  // Сетка содержит только полные недели, чтобы колонки дней оставались выровненными.
  const days = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstDayOffset + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const shiftMonth = (amount: number) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const formatDate = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="date-picker-panel">
      <nav className="task-date-quick-links" aria-label="Quick dates">
        {(["Today", "Tomorrow", "This weekend", "Next week"] as const).map((shortcut) => (
          <button type="button" key={shortcut} onClick={() => onChange(getDateShortcut(shortcut))}>
            {shortcut}
          </button>
        ))}
      </nav>
      <label className="date-picker-input">
        Date
        <input
          autoFocus={autoFocus}
          type="date"
          aria-label={inputLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div className="date-picker-calendar">
        <header>
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            ‹
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
            ›
          </button>
        </header>
        <div className="date-picker-grid" role="grid" aria-label={monthLabel}>
          {dayLabels.map((label) => (
            <span className="date-picker-weekday" role="columnheader" key={label}>
              {label}
            </span>
          ))}
          {days.map((day, index) => {
            if (day === null)
              return (
                <span
                  role="gridcell"
                  aria-hidden="true"
                  className="date-picker-empty"
                  key={`empty-${index}`}
                />
              );
            const date = `${month}-${String(day).padStart(2, "0")}`;
            return (
              <span role="gridcell" key={date}>
                <button
                  type="button"
                  aria-label={`Choose date ${formatDate(date)}`}
                  aria-current={today === date ? "date" : undefined}
                  aria-pressed={value === date}
                  className={clsx(value === date && "selected", today === date && "today")}
                  onClick={() => onChange(date)}
                >
                  {day}
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
