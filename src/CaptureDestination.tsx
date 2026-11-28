import { DateTimeField } from "./DateTimeField";
import { taskCategory } from "./taskColors";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./navigation";
import { label, localInput, parseInput } from "./model";

export type CaptureRoute =
  | { destination: "Inbox" | "DoNow" | "Settled" }
  | { destination: "Scheduled"; scheduledAt: number }
  | { destination: "Snoozed"; wakeAt: number }
  | { destination: "Waiting"; reason: string; wakeAt?: number };

const destinations = [
  "Inbox",
  "DoNow",
  "Scheduled",
  "Settled",
  "Snoozed",
  "Waiting",
] as const;

export function CaptureDestination({
  valid,
  busy,
  onChoose,
  quick = false,
}: {
  quick?: boolean;
  valid: boolean;
  busy: boolean;
  onChoose: (route: CaptureRoute) => void;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<
    "Scheduled" | "Snoozed" | "Waiting" | null
  >(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const visible = open && valid && !busy;
  function stop() {
    clearTimeout(timer.current);
  }
  function show() {
    if (!valid || busy) return;
    setDetails(null);
    setDate("");
    setReason("");
    setOpen(true);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!valid || busy) {
      clearTimeout(timer.current);
      setOpen(false);
    }
  }, [valid, busy]);
  useEffect(() => {
    if (!visible) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !root.current?.contains(target) &&
        !target.closest(".control-shield, .control-popup")
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [visible]);
  useEffect(() => {
    if (visible)
      panel.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, [visible, details]);
  function choose(route: CaptureRoute) {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    onChoose(route);
  }
  const time = parseInput(date);
  const earliestWake = Math.floor(Date.now() / 1000 / 60) * 60 + 60;
  function submitDetails() {
    const input =
      panel.current?.querySelector<HTMLInputElement>(".date-field input");
    if (input && !input.reportValidity()) return;
    if (details === "Scheduled" && time != null && time >= earliestWake)
      choose({ destination: details, scheduledAt: time });
    if (details === "Snoozed" && time != null && time >= earliestWake)
      choose({ destination: details, wakeAt: time });
    if (details === "Waiting")
      choose({
        destination: details,
        reason: reason.trim(),
        wakeAt: time ?? undefined,
      });
  }
  return (
    <div
      ref={root}
      className="capture-route"
      onKeyDown={(event) => {
        if (event.key === "Escape" && visible) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="primary"
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={visible}
        data-tooltip="Hold for options."
        aria-keyshortcuts="Alt+ArrowDown"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          held.current = false;
          stop();
          if (valid)
            timer.current = setTimeout(() => {
              held.current = true;
              show();
            }, 450);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(event) => {
          if (held.current || visible) {
            event.preventDefault();
            held.current = false;
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          stop();
          show();
        }}
        onKeyDown={(event) => {
          held.current = false;
          if (
            (event.altKey && event.key === "ArrowDown") ||
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")
          ) {
            event.preventDefault();
            show();
          }
        }}
      >
        {busy ? "Saving..." : quick ? "Send to..." : "Add to Inbox"}{" "}
        <span aria-hidden="true">&crarr;</span>
      </button>
      {visible && (
        <div
          ref={panel}
          className="capture-destinations"
          role="dialog"
          aria-label="Capture destination"
        >
          {details ? (
            <>
              {details === "Waiting" && (
                <label>
                  Waiting on
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitDetails();
                      }
                    }}
                  />
                </label>
              )}
              <div
                className="capture-route-time"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    event.target instanceof HTMLInputElement
                  ) {
                    event.preventDefault();
                    submitDetails();
                  }
                }}
              >
                {details === "Scheduled"
                  ? "Scheduled start"
                  : details === "Snoozed"
                    ? "Return time"
                    : "Follow-up time (optional)"}
                <DateTimeField
                  aria-label={
                    details === "Scheduled"
                      ? "Scheduled start"
                      : details === "Snoozed"
                        ? "Return time"
                        : "Follow-up time"
                  }
                  inlinePicker={quick}
                  type="datetime-local"
                  required={details !== "Waiting"}
                  min={
                    details !== "Waiting" ? localInput(earliestWake) : undefined
                  }
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="capture-route-actions">
                <button
                  type="button"
                  onClick={() => {
                    setDate("");
                    setDetails(null);
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={
                    details !== "Waiting" &&
                    (time == null ||
                      (details === "Snoozed" && time < earliestWake))
                  }
                  onClick={submitDetails}
                >
                  Add to {label(details)}
                </button>
              </div>
            </>
          ) : (
            destinations.map((destination) => (
              <button
                key={destination}
                data-status={taskCategory(destination)}
                type="button"
                onClick={() => {
                  if (
                    destination === "Scheduled" ||
                    destination === "Snoozed" ||
                    destination === "Waiting"
                  ) {
                    setDetails(destination);
                  } else choose({ destination });
                }}
              >
                <Icon name={destination} sidebar /> {label(destination)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
