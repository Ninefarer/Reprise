import { useEffect, useRef, useState } from "react";
import { commandDestinations } from "./navigation";
import { label, matches, type Task, type View } from "./model";
import { taskActions, type ActionId } from "./taskActions";
import { taskCategory } from "./taskColors";
export function CommandPalette({
  tasks,
  shortcut,
  onClose,
  onNavigate,
  onTask,
  onAction,
  onCreate,
}: {
  tasks: Task[];
  shortcut: string;
  onClose: () => void;
  onNavigate: (v: View) => void;
  onTask: (t: Task) => void;
  onAction: (t: Task, id: ActionId) => void;
  onCreate: (title: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("All"),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState<Task | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    ref.current
      ?.querySelector(".palette-results .selected")
      ?.scrollIntoView?.({ block: "nearest" });
  }, [index]);
  useEffect(() => {
    if (selected)
      ref.current
        ?.querySelector<HTMLButtonElement>(".palette-results button")
        ?.focus();
  }, [selected]);
  const results: { id: string; text: string; run: () => void; task?: Task }[] =
    selected
      ? taskActions(selected).map((a) => ({
          id: a.id,
          text: a.label,
          run: () => onAction(selected, a.id),
        }))
      : [
          ...commandDestinations
            .filter((v) => label(v).toLowerCase().includes(q.toLowerCase()))
            .map((v) => ({
              id: `nav-${v}`,
              text: `Go to ${label(v)}`,
              run: () => onNavigate(v),
            })),
          ...tasks
            .filter(
              (t) => matches(t, q) && (status === "All" || t.status === status),
            )
            .slice(0, 30)
            .map((t) => ({
              id: t.id,
              text: `${t.title} · ${label(t.status)}`,
              run: () => onTask(t),
              task: t,
            })),
          ...(q.trim()
            ? [
                {
                  id: "create",
                  text: `Create in Inbox: ${q.trim()}`,
                  run: () => void onCreate(q.trim()),
                },
              ]
            : []),
        ];
  const choose = (i: number) => {
    const r = results[i];
    if (!r) return;
    r.run();
    onClose();
  };
  return (
    <dialog
      ref={ref}
      className="palette task-dialog material-floating"
      aria-label="Command palette"
      onCancel={onClose}
    >
      <div className="palette-head">
        <h2>
          {selected ? `Actions · ${selected.title}` : "Find a task or command"}
        </h2>
        <button onClick={onClose} aria-label="Close command palette">
          ×
        </button>
      </div>
      {selected ? (
        <button
          onClick={() => {
            setSelected(null);
            setIndex(0);
          }}
        >
          ← Back to search
        </button>
      ) : (
        <>
          <input
            autoFocus
            aria-label="Global task and command search"
            placeholder="Search every task or switch views…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setIndex(
                  (i) =>
                    (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                    Math.max(1, results.length),
                );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                choose(index);
              }
            }}
          />
          <label className="palette-filter">
            Task status
            <select
              value={status}
              data-status={taskCategory(status)}
              onChange={(e) => {
                setStatus(e.target.value);
                setIndex(0);
              }}
            >
              {[
                "All",
                "Inbox",
                "DoNow",
                "Scheduled",
                "Settled",
                "Snoozed",
                "Waiting",
                "Finished",
                "Dropped",
              ].map((s) => (
                <option key={s} value={s} data-status={taskCategory(s)}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          {q && (
            <button
              onClick={() => {
                setQ("");
                setIndex(0);
              }}
            >
              Clear global search
            </button>
          )}
        </>
      )}
      <div
        className="palette-results"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const next =
              (index + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
              Math.max(1, results.length);
            setIndex(next);
            ref.current
              ?.querySelectorAll<HTMLButtonElement>(
                ".palette-results>div>button:first-child",
              )
              [next]?.focus();
          }
        }}
      >
        <span className="sr-only" role="status" aria-live="polite">
          {results.length
            ? `${results.length} results. Selected: ${results[index]?.text ?? results[0].text}`
            : "No results"}
        </span>
        {!selected && q.trim() && !results.some((r) => r.task) && (
          <p className="hint">
            No matching tasks. Create a new task in Inbox below.
          </p>
        )}
        {results.length ? (
          results.map((r, i) => (
            <div key={r.id} className={i === index ? "selected" : ""}>
              <button onClick={() => choose(i)}>{r.text}</button>
              {"task" in r && r.task && (
                <button
                  aria-label={`Actions for ${r.task.title}`}
                  onClick={() => {
                    setSelected(r.task!);
                    setIndex(0);
                  }}
                >
                  •••
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No matching tasks or commands.</p>
        )}
      </div>
      <small>
        {shortcut} · ↑ ↓ to select · Enter to open · Escape to close
      </small>
    </dialog>
  );
}
