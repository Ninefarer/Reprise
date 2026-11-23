export type DateInputKind = "time" | "datetime-local";
const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const pad = (n: number) => String(n).padStart(2, "0");
export function parseClock(text: string): string | null {
  if (/^noon$/i.test(text.trim())) return "12:00";
  if (/^midnight$/i.test(text.trim())) return "00:00";
  const compact = text.trim().match(/^(\d{2})(\d{2})$/);
  if (compact) return parseClock(`${compact[1]}:${compact[2]}`);
  const match = text
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23))
    return null;
  if (match[3]) hour = (hour % 12) + (match[3] === "pm" ? 12 : 0);
  return `${pad(hour)}:${pad(minute)}`;
}
export function validLocalValue(value: string, kind: DateInputKind) {
  if (kind === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!/^\d{4}-\d\d-\d\dT([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
/** Local wall-time input, including relative phrases; ambiguous numeric dates are rejected. */
export function parseDateInput(
  text: string,
  kind: DateInputKind,
  previous = "",
  now = new Date(),
): string | null {
  if (!text.trim()) return "";
  if (kind === "time") return parseClock(text);
  if (validLocalValue(text, kind)) return text;
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/,/g, " ")
    .replace(/\s*@\s*/g, " at ")
    .replace(/\s+/g, " ");
  const local = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const relative = normalized.match(
    /^in (\d+) (minutes?|mins?|hours?|hrs?|days?|weeks?)$/,
  );
  if (relative) {
    const amount = Number(relative[1]);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10000)
      return null;
    const date = new Date(now);
    if (/^(day|week)/.test(relative[2]))
      date.setDate(
        date.getDate() + amount * (relative[2].startsWith("week") ? 7 : 1),
      );
    else
      date.setTime(
        date.getTime() +
          amount * (/^(hour|hr)/.test(relative[2]) ? 3600000 : 60000),
      );
    const result = local(date);
    return validLocalValue(result, kind) ? result : null;
  }
  const named = normalized.match(
    /^(today|tomorrow|(?:next )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))(?: (?:at )?(.+))?$/,
  );
  if (named) {
    const date = new Date(now);
    const weekdays = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const word = named[1].replace(/^next /, "");
    const offset =
      word === "today"
        ? 0
        : word === "tomorrow"
          ? 1
          : (weekdays.indexOf(word) - now.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + offset);
    const clock = named[2]
      ? parseClock(named[2])
      : validLocalValue(previous, kind)
        ? previous.slice(-5)
        : "09:00";
    return clock ? `${local(date).slice(0, 10)}T${clock}` : null;
  }
  // Month names without a year refer to the current calendar year.
  const short = normalized.match(
    /^([a-z]+\.? \d{1,2}|\d{1,2} [a-z]+\.?)(?: (?:at )?(.+))?$/,
  );
  if (
    short &&
    (!short[2] ||
      (!/^\d{1,4}(?: |$)/.test(short[2]) && parseClock(short[2]) !== null))
  )
    return parseDateInput(
      `${short[1]} ${now.getFullYear()}${short[2] ? " at " + short[2] : ""}`,
      kind,
      previous,
      now,
    );
  const numeric = normalized.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?: (?:at )?(.+))?$/,
  );
  if (numeric) {
    const a = Number(numeric[1]),
      b = Number(numeric[2]);
    if (a <= 12 && b <= 12 && a !== b) return null;
    const month = a > 12 ? b : a,
      day = a > 12 ? a : b;
    return parseDateInput(
      `${numeric[3]}-${pad(month)}-${pad(day)}${numeric[4] ? " at " + numeric[4] : ""}`,
      kind,
      previous,
      now,
    );
  }
  let year: number, month: number, day: number, time: string | undefined;
  const iso = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ](?:at )?(.+))?$/,
  );
  const first = normalized.match(
    /^([a-z]+)\.? (\d{1,2}) (\d{4})(?: (?:at )?(.+))?$/,
  );
  const last = normalized.match(
    /^(\d{1,2}) ([a-z]+)\.? (\d{4})(?: (?:at )?(.+))?$/,
  );
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
    time = iso[4];
  } else if (first || last) {
    const match = (first ?? last)!;
    const name = first ? match[1] : match[2];
    month =
      months.findIndex(
        (value) =>
          value === name ||
          value.slice(0, 3) === name ||
          (name === "sept" && value === "september"),
      ) + 1;
    day = Number(first ? match[2] : match[1]);
    year = Number(match[3]);
    time = match[4];
  } else return null;
  const clock = time
    ? parseClock(time)
    : validLocalValue(previous, kind)
      ? previous.slice(-5)
      : "09:00";
  if (!clock) return null;
  const result = `${year}-${pad(month)}-${pad(day)}T${clock}`;
  return validLocalValue(result, kind) ? result : null;
}
export function displayDateInput(value: string, kind: DateInputKind) {
  if (!validLocalValue(value, kind)) return value;
  const time = kind === "time" ? value : value.slice(-5);
  const [hour, minute] = time.split(":").map(Number);
  const clock = `${hour % 12 || 12}:${pad(minute)} ${hour >= 12 ? "PM" : "AM"}`;
  if (kind === "time") return clock;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return `${months[month - 1][0].toUpperCase()}${months[month - 1].slice(1)} ${day}, ${year} at ${clock}`;
}
