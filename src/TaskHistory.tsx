import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { label, type History } from "./model";
import { taskCategory } from "./taskColors";

function snapshot(raw: string | null): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (value && typeof value === "object")
      return value as Record<string, unknown>;
  } catch {
    // Older entries can lack a readable snapshot.
  }
  return {};
}

export function historyCategory(entry: History) {
  const { status } = snapshot(entry.after);
  if (typeof status !== "string") return undefined;
  return ["Resurfaced", "ResurfaceNow", "WakeNow"].includes(entry.action)
    ? "Resurfaced"
    : taskCategory(status);
}

const editFields = {
  title: "title",
  description: "description",
  priority: "priority",
  energy: "energy",
  project: "project",
  tags: "tags",
  scheduled_at: "scheduled date",
  due_at: "deadline",
  wake_at: "return time",
  reason: "waiting reason",
} as const;

function describe(entry: History) {
  const before = snapshot(entry.before);
  const after = snapshot(entry.after);
  const status = typeof after.status === "string" ? label(after.status) : "";
  const transition =
    typeof before.status === "string" &&
    status &&
    before.status !== after.status
      ? `${label(before.status)} to ${status}.`
      : "";
  switch (entry.action) {
    case "AutoSettled":
      return {
        title: "Auto-settled by Reprise",
        detail:
          typeof after._auto_settle_days === "number"
            ? `Moved from Inbox after ${after._auto_settle_days} days without a next step.`
            : transition,
      };
    case "Created":
      return {
        title: "Task created",
        detail: status ? `Added to ${status}.` : "",
      };
    case "Edited": {
      const changed = Object.entries(editFields)
        .filter(
          ([key]) =>
            key in before && key in after && before[key] !== after[key],
        )
        .map(([, name]) => name);
      return {
        title: "Task edited",
        detail: changed.length ? `Changed ${changed.join(", ")}.` : "",
      };
    }
    case "Resurfaced":
      return {
        title: "Resurfaced by Reprise",
        detail: "Returned on schedule.",
      };
    case "ResurfaceNow":
    case "WakeNow":
      return {
        title: "Brought back early",
        detail: "Moved to the Resurfaced queue.",
      };
    case "Resumed":
      return { title: "Task resumed", detail: transition };
    case "Undone":
      return { title: "Previous action undone", detail: transition };
    default:
      return {
        title: label(entry.action).replace(/([a-z])([A-Z])/g, "$1 $2"),
        detail: transition,
      };
  }
}

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

export function TaskHistory({
  taskId,
  standalone = false,
}: {
  taskId: string;
  standalone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<History[] | null>(null),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if ((!standalone && !open) || history) return;
    let alive = true;
    setError("");
    void invoke<History[]>("task_history", { id: taskId })
      .then((value) => {
        if (alive) setHistory(value);
      })
      .catch((reason) => {
        if (alive) setError(String(reason));
      });
    return () => {
      alive = false;
    };
  }, [open, standalone, taskId, history, attempt]);
  const groups: { day: string; entries: History[] }[] = [];
  // The store returns newest first, including entries with identical timestamps.
  for (const entry of (history ?? []).slice().reverse()) {
    const day = dayFormat.format(entry.at * 1000);
    const previous = groups.at(-1);
    if (previous?.day === day) previous.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }

  const content = error ? (
    <p role="alert">
      {error}{" "}
      <button type="button" onClick={() => setAttempt((value) => value + 1)}>
        Retry
      </button>
    </p>
  ) : history === null ? (
    <p role="status">Loading history…</p>
  ) : !history.length ? (
    <p>No status changes recorded.</p>
  ) : (
    <div className="history-timeline">
      {groups.map(({ day, entries }, groupIndex) => (
        <div key={groupIndex}>
          <h3>{day}</h3>
          <ol role="list">
            {entries.map((entry, index) => {
              const category = historyCategory(entry);
              const { title, detail } = describe(entry);
              return (
                <li key={index} data-status={category}>
                  <div className="history-entry">
                    <span className="history-action" data-status={category}>
                      {title}
                    </span>
                    <time dateTime={new Date(entry.at * 1000).toISOString()}>
                      {timeFormat.format(entry.at * 1000)}
                    </time>
                    {detail && <p>{detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
  if (standalone) return content;
  return (
    <details
      className="task-history"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Task history</summary>
      {content}
    </details>
  );
}
