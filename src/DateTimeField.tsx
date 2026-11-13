import { useEffect, useId, useRef, useState } from "react";
import { ControlPopup } from "./ControlPopup";
import "./controls.css";

export function validLocalValue(
  value: string,
  type: "time" | "datetime-local",
) {
  if (type === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!/^\d{4}-\d\d-\d\dT([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return (
    year >= 1000 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
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
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const errorId = useId();
  const message =
    text && (!validLocalValue(text, type) || (min && text < min))
      ? min && validLocalValue(text, type)
        ? "Choose a later time."
        : type === "time"
          ? "Use HH:mm (24-hour time)."
          : "Use YYYY-MM-DDTHH:mm."
      : required && !text
        ? "Choose a time."
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
        placeholder={type === "time" ? "HH:mm" : "YYYY-MM-DDTHH:mm"}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (!event.target.value || validLocalValue(event.target.value, type))
            onChange(event);
        }}
        onBlur={() => setError(message)}
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
        aria-label={type === "time" ? "Choose time" : "Choose date and time"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ◷
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
              setText(next);
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
              value={month.getFullYear()}
              onChange={(e) => {
                const year = Number(e.target.value);
                if (year >= 1000 && year <= 9999)
                  setMonth(new Date(year, month.getMonth(), 1, 12));
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
