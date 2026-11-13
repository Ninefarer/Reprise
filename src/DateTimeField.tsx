import { displayDateInput, parseDateInput, validLocalValue } from "./dateInput";
export { validLocalValue } from "./dateInput";
import { useEffect, useId, useRef, useState } from "react";
import { ControlPopup } from "./ControlPopup";
import "./controls.css";

export function DateTimeField({
  type,
  value,
  onChange,
  required,
  min,
  ...props
}: {
  type: "time" | "datetime-local";
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  required?: boolean;
  min?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const editing = useRef(false);
  // Keep the last explicit clock when replacing a date, even after clearing it.
  const previous = useRef(value);
  if (validLocalValue(value, type)) previous.current = value;
  const [text, setText] = useState(() => displayDateInput(value, type));
  useEffect(() => {
    if (!editing.current) setText(displayDateInput(value, type));
  }, [value, type]);
  const parsed = parseDateInput(text, type, previous.current);
  const errorId = useId();
  const message =
    text.trim() && (parsed === null || (min && parsed < min))
      ? parsed !== null
        ? "Choose a later time."
        : type === "time"
          ? "Enter a time such as 9am or 2:30pm."
          : "Enter a date such as March 3, 2027 at 9am."
      : required && !text.trim()
        ? type === "time"
          ? "Choose a time."
          : "Choose a date and time."
        : "";
  useEffect(() => {
    input.current?.setCustomValidity(message);
    if (!message) setError("");
  }, [message]);
  return (
    <span className="date-field">
      <input
        {...props}
        ref={input}
        type="text"
        value={text}
        required={required}
        spellCheck={false}
        placeholder={type === "time" ? "9:00 AM" : "March 3, 2027 at 9am"}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setText(event.target.value);
          const next = parseDateInput(
            event.target.value,
            type,
            previous.current,
          );
          if (next !== null) onChange({ target: { value: next } });
        }}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
          setError(message);
          if (parsed !== null) setText(displayDateInput(parsed, type));
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setError(message);
          input.current?.focus();
        }}
      />
      <button
        ref={trigger}
        type="button"
        className="date-picker-trigger"
        aria-label={
          props["aria-label"]
            ? `Choose ${type === "time" ? "time" : "date and time"} for ${props["aria-label"]}`
            : type === "time"
              ? "Choose time"
              : "Choose date and time"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </svg>
      </button>
      {error && (
        <span id={errorId} role="alert" className="field-error">
          {error}
        </span>
      )}
      {open && (
        <ControlPopup anchor={trigger} onClose={() => setOpen(false)}>
          <DateTimePicker
            type={type}
            value={value}
            min={min}
            required={required}
            onCancel={() => setOpen(false)}
            onApply={(next) => {
              setText(displayDateInput(next, type));
              onChange({ target: { value: next } });
              setOpen(false);
              trigger.current?.focus();
            }}
          />
        </ControlPopup>
      )}
    </span>
  );
}
function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function DateTimePicker({
  type,
  value,
  min,
  required,
  onCancel,
  onApply,
}: {
  type: "time" | "datetime-local";
  value: string;
  min?: string;
  required?: boolean;
  onCancel: () => void;
  onApply: (value: string) => void;
}) {
  const today = new Date();
  const initial = validLocalValue(value, type)
    ? value
    : type === "time"
      ? "09:00"
      : `${localDate(today)}T09:00`;
  const [selected, setSelected] = useState(
    type === "time" ? localDate(today) : initial.slice(0, 10),
  );
  const [month, setMonth] = useState(() => new Date(`${selected}T12:00`));
  const [time, setTime] = useState(initial.slice(-5));
  const [focused, setFocused] = useState(selected);
  const grid = useRef<HTMLDivElement>(null);
  const output = type === "time" ? time : `${selected}T${time}`;
  const valid = validLocalValue(output, type) && (!min || output >= min);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  function moveMonth(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12));
  }
  return (
    <div
      className="date-picker"
      role="dialog"
      aria-label={type === "time" ? "Time picker" : "Date and time picker"}
    >
      {type !== "time" && (
        <>
          <div className="calendar-heading">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <span aria-live="polite">
              {month.toLocaleDateString(undefined, { month: "long" })}
            </span>
            <input
              aria-label="Calendar year"
              inputMode="numeric"
              key={month.getFullYear()}
              defaultValue={month.getFullYear()}
              onBlur={(e) => {
                const year = Number(e.target.value);
                if (Number.isInteger(year) && year >= 1000 && year <= 9999)
                  setMonth(new Date(year, month.getMonth(), 1, 12));
                else e.target.value = String(month.getFullYear());
              }}
            />
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div
            ref={grid}
            className="calendar-days"
            role="group"
            aria-label="Calendar dates"
          >
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const at = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  i + 1,
                  12,
                ),
                key = localDate(at);
              return (
                <button
                  type="button"
                  key={key}
                  aria-label={at.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  aria-pressed={selected === key}
                  tabIndex={
                    focused.slice(0, 7) === key.slice(0, 7)
                      ? focused === key
                        ? 0
                        : -1
                      : i === 0
                        ? 0
                        : -1
                  }
                  onClick={() => {
                    setSelected(key);
                    setFocused(key);
                  }}
                  onKeyDown={(e) => {
                    const deltas: Record<string, number> = {
                      ArrowLeft: -1,
                      ArrowRight: 1,
                      ArrowUp: -7,
                      ArrowDown: 7,
                      Home: -at.getDay(),
                      End: 6 - at.getDay(),
                    };
                    if (
                      e.key in deltas ||
                      e.key === "PageUp" ||
                      e.key === "PageDown"
                    ) {
                      e.preventDefault();
                      const next = new Date(at);
                      if (e.key.startsWith("Page")) {
                        next.setDate(1);
                        next.setMonth(
                          next.getMonth() + (e.key === "PageUp" ? -1 : 1),
                        );
                      } else next.setDate(at.getDate() + deltas[e.key]);
                      const nextKey = localDate(next);
                      setMonth(next);
                      setFocused(nextKey);
                      requestAnimationFrame(() =>
                        grid.current
                          ?.querySelector<HTMLButtonElement>(
                            `[data-date="${nextKey}"]`,
                          )
                          ?.focus(),
                      );
                    }
                  }}
                  data-date={key}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const next = localDate(today);
              setSelected(next);
              setFocused(next);
              setMonth(today);
            }}
          >
            Today
          </button>
        </>
      )}
      <label>
        Time (24-hour)
        <input
          type="text"
          inputMode="numeric"
          value={time}
          maxLength={5}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      <div className="time-presets">
        {["09:00", "12:00", "15:00", "18:00"].map((t) => (
          <button type="button" key={t} onClick={() => setTime(t)}>
            {t}
          </button>
        ))}
      </div>
      {!valid && (
        <p role="alert">
          {validLocalValue(output, type)
            ? "Choose a later time."
            : "Enter a valid time as HH:mm."}
        </p>
      )}
      <div className="picker-actions">
        {!required && (
          <button type="button" onClick={() => onApply("")}>
            Clear
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={!valid}
          onClick={() => onApply(output)}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
