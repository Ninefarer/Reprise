import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { date, label, type History } from "./model";
import { taskCategory } from "./taskColors";

export function historyCategory(entry: History) {
  try {
    const after: unknown = JSON.parse(entry.after);
    if (!after || typeof after !== "object") return undefined;
    if (
      entry.action === "Resurfaced" ||
      entry.action === "ResurfaceNow" ||
      entry.action === "WakeNow"
    )
      return "Resurfaced";
    return "status" in after && typeof after.status === "string"
      ? taskCategory(after.status)
      : undefined;
  } catch {
    return undefined;
  }
}
export function TaskHistory({
  taskId,
  initiallyOpen = false,
}: {
  taskId: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [history, setHistory] = useState<History[] | null>(null),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || history) return;
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
  }, [open, taskId, history, attempt]);
  return (
    <details
      className="history task-history"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Task history</summary>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </button>
        </p>
      ) : history === null ? (
        <p role="status">Loading history…</p>
      ) : !history.length ? (
        <p>No status changes recorded.</p>
      ) : (
        <ol>
          {history.map((entry, index) => {
            const category = historyCategory(entry);
            return (
              <li key={`${entry.at}/${index}`}>
                <span className="history-action" data-status={category}>
                  {label(entry.action)}
                  {category ? ` · ${label(category)}` : ""}
                </span>
                <time dateTime={new Date(entry.at * 1000).toISOString()}>
                  {date(entry.at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}
