import clsx from "clsx";
import { Tag, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toLocalIsoDate } from "../dateUtils";

/**
 * Props for a textarea that automatically adjusts its height to its content.
 *
 * @typedef {Object} AutoGrowTextareaProps
 * @property {string} value - Current textarea value.
 * @property onChange - Handles value changes.
 * @property {string} ariaLabel - Accessible name for the control.
 * @property {string} [id] - Unique element ID.
 * @property {string} [placeholder] - Placeholder text shown in the field.
 * @property {boolean} [autoFocus] - Whether to focus the field after rendering.
 * @property {boolean} [required] - Whether the field is required.
 * @property {string} [className] - Additional CSS classes for the element.
 * @property [onKeyDown] - Handles key presses.
 * @property {React.ClipboardEventHandler<HTMLTextAreaElement>} [onPaste] - Handles paste events.
 */
export type AutoGrowTextareaProps = {
  value: string;

  onChange: (value: string) => void;

  ariaLabel: string;

  id?: string;

  placeholder?: string;

  autoFocus?: boolean;

  required?: boolean;

  className?: string;

  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;

  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
};

/**
 * Renders a textarea whose height follows the amount of entered text.
 *
 * @param {AutoGrowTextareaProps} parameter1
 * @returns The auto-growing textarea element.
 */
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
  /**
   * Reset the previous height before measuring so the field can shrink with its content.
   */
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

/**
 * Values and handlers for the label picker.
 *
 * @typedef {Object} LabelPickerProps
 * @property {Array<string>} selected - Currently selected labels.
 * @property {Array<string>} options - Available labels for this component.
 * @property {string} inputLabel - Accessible label for the input.
 * @property {string} inputValue - Current input value.
 * @property onInputChange - Handles input text changes.
 * @property onChange - Handles selection changes.
 * @property {boolean} [autoFocus] - Whether to focus the field after rendering.
 */
type LabelPickerProps = {
  selected: Array<string>;

  options: Array<string>;

  inputLabel: string;

  inputValue: string;

  onInputChange: (value: string) => void;

  onChange: (labels: Array<string>) => void | Promise<unknown>;

  autoFocus?: boolean;
};

/**
 * Trims whitespace and removes duplicate labels regardless of letter case.
 *
 * @param {Array<string>} labels
 * @returns {Array<string>}
 */
export const normalizeLabels = (labels: Array<string>): Array<string> =>
  labels.reduce<Array<string>>((result, label) => {
    const normalized = label.trim();
    return normalized && !result.some((item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase())
      ? [...result, normalized]
      : result;
  }, []);

/**
 * Allows label editing and rolls back the local change if saving fails.
 *
 * @param {LabelPickerProps} parameter1
 * @returns The label picker element.
 */
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
  /**
   * Show the update immediately, but restore the selection if the API call fails.
   *
   * @param {Array<string>} labels
   */
  const commit = async (labels: Array<string>) => {
    /** Normalize labels to remove empty values and case-insensitive duplicates before saving. */
    const next = normalizeLabels(labels);
    setCurrent(next);
    try {
      await onChange(next);
    } catch {
      /** If the API call fails, restore the last confirmed value from props. */
      setCurrent(selected);
    }
  };
  const addLabel = async (label: string) => {
    /** Clear the input and suggestions immediately, and submit only a new label. */
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
    /** A comma commits one or more labels; keep the final fragment as a draft. */
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

/**
 * Day and its position flags for a calendar grid cell.
 *
 * @typedef {Object} CalendarDay
 * @property {string} date - Calendar date.
 * @property {number} day - Day of the month.
 * @property {boolean} isCurrentMonth - Whether the day belongs to the current month.
 * @property {boolean} isToday - Whether the day is today.
 * @property {boolean} isWeekend - Whether the day falls on a weekend.
 */
type CalendarDay = {
  date: string;

  day: number;

  isCurrentMonth: boolean;

  isToday: boolean;

  isWeekend: boolean;
};

/** Short calendar grid labels, starting with Monday. */
export const calendarWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Converts an ISO month (`YYYY-MM`) to numeric components.
 *
 * @param {string} month
 */
const calendarMonthParts = (month: string) => ({
  year: Number(month.slice(0, 4)),
  monthIndex: Number(month.slice(5, 7)) - 1,
});

/**
 * Formats a UTC date as an ISO calendar day string.
 *
 * @param {Date} date
 */
const isoDateFromUtc = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

/**
 * Moves a month forward or backward by the specified number of months.
 *
 * @param {string} month
 * @param {number} amount
 * @returns The shifted month in ISO format.
 */
export const shiftCalendarMonth = (month: string, amount: number) => {
  const { year, monthIndex } = calendarMonthParts(month);
  const shifted = new Date(Date.UTC(year, monthIndex + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * Creates a localized month label for the calendar heading.
 *
 * @param {string} month
 * @returns The localized month label.
 */
export const calendarMonthLabel = (month: string) => {
  const { year, monthIndex } = calendarMonthParts(month);
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

/**
 * Creates a six-week grid and fills it with days from adjacent months.
 *
 * @param {string} month
 * @returns {Array<CalendarDay>}
 */
export const buildCalendarDays = (month: string): Array<CalendarDay> => {
  const { year, monthIndex } = calendarMonthParts(month);
  /** Start the first column on Monday and use UTC dates to avoid local DST shifts. */
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

/**
 * Converts a quick date selection to an ISO date for the task due date field.
 *
 * @param {"Today" | "Tomorrow" | "This weekend" | "Next week"} shortcut
 * @returns The selected due date in ISO format.
 */
const getDateShortcut = (shortcut: "Today" | "Tomorrow" | "This weekend" | "Next week") => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (shortcut === "Tomorrow") date.setDate(date.getDate() + 1);
  if (shortcut === "This weekend") date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7));
  if (shortcut === "Next week") date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  return toLocalIsoDate(date);
};

/**
 * Shows quick due date options and a calendar for choosing a task date.
 *
 * @param {{ value: string; onChange: (value: string) => void; inputLabel: string; autoFocus?: boolean; }} parameter1
 * @param {string} parameter1.value - Selected due date in ISO format, or an empty string.
 * @param {(value: string) => void} parameter1.onChange - Passes the new date to the form owner.
 * @param {string} parameter1.inputLabel - Accessible name for the date picker field.
 * @param {boolean} parameter1.autoFocus - Whether to focus the field when the panel opens.
 * @returns The due date picker element.
 */
export const DatePickerPanel = ({
  value,
  onChange,
  inputLabel,
  autoFocus = false,
}: {
  value: string;

  onChange: (value: string) => void;

  inputLabel: string;

  autoFocus?: boolean;
}) => {
  const [month, setMonth] = useState(() => (value || getDateShortcut("Today")).slice(0, 7));
  const today = toLocalIsoDate(new Date());
  useEffect(() => {
    /** When the due date changes externally, show the month containing that date. */
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
  /** Use complete weeks so the day columns remain aligned. */
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
