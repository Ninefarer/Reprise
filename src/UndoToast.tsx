import { SlideSlot, NOTICE_MOTION_MS } from "./SlideSlot";
import { useEffect, useRef, useState } from "react";
export interface UndoNotice {
  key: string;
  id: string;
  revision: number;
  title: string;
  deletionToken?: string;
}
export const DELETE_UNDO_MS = 30000;
export const UPDATE_UNDO_MS = 8000;
export const MAX_VISIBLE_NOTICES = 3;
export function UndoToast({
  notice,
  onUndo,
  onDone,
  onExpire,
}: {
  notice: UndoNotice;
  onUndo: () => Promise<boolean>;
  onDone: () => void;
  onExpire: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const locked = useRef(false);
  const processing = useRef(false);
  const deletion = !!notice.deletionToken;
  const remaining = useRef(deletion ? DELETE_UNDO_MS : UPDATE_UNDO_MS);
  const paused = hovered || focused || pending;
  const callbacks = useRef({ onDone, onExpire });
  callbacks.current = { onDone, onExpire };
  function leave(finalize: boolean) {
    if (locked.current) return;
    locked.current = true;
    setLeaving(true);
    if (finalize) callbacks.current.onExpire();
  }
  useEffect(() => {
    if (paused || leaving) return;
    const start = performance.now();
    const timer = setTimeout(() => leave(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (performance.now() - start),
      );
    };
  }, [paused, leaving]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(
      () => callbacks.current.onDone(),
      NOTICE_MOTION_MS,
    );
    return () => clearTimeout(timer);
  }, [leaving]);
  return (
    <SlideSlot leaving={leaving}>
      <div
        className="undo-toast slide-card"
        data-leaving={leaving}
        role="status"
        inert={leaving}
        onMouseEnter={() => {
          if (!locked.current) setHovered(true);
        }}
        onMouseLeave={() => {
          if (!locked.current) setHovered(false);
        }}
        onFocus={() => {
          if (!locked.current) setFocused(true);
        }}
        onBlur={(e) => {
          if (!locked.current && !e.currentTarget.contains(e.relatedTarget))
            setFocused(false);
        }}
      >
        <span>
          {deletion ? "Deleted" : "Updated"} &ldquo;{notice.title}&rdquo;
        </span>
        <button
          disabled={leaving || pending}
          onClick={async () => {
            if (locked.current || processing.current) return;
            processing.current = true;
            setPending(true);
            try {
              if (await onUndo()) leave(false);
            } finally {
              processing.current = false;
              setPending(false);
            }
          }}
        >
          Undo
        </button>
        <button
          aria-label="Dismiss undo"
          disabled={leaving || pending}
          onClick={() => leave(true)}
        >
          &times;
        </button>
        <small>
          {deletion
            ? "Click undo to revert the deletion."
            : "Notifications already submitted to Windows are not recalled."}
        </small>
        {deletion && (
          <div className="undo-drain" aria-hidden="true">
            <div
              style={{
                animationPlayState: paused || leaving ? "paused" : "running",
              }}
            />
          </div>
        )}
      </div>
    </SlideSlot>
  );
}

export function UndoToastStack({
  notices,
  onDone,
  onExpire,
  onUndo,
}: {
  notices: UndoNotice[];
  onDone: (notice: UndoNotice) => void;
  onExpire: (notice: UndoNotice) => void;
  onUndo: (notice: UndoNotice) => Promise<boolean>;
}) {
  return (
    <div className="undo-toasts" aria-label="Task action notifications">
      {notices.slice(0, MAX_VISIBLE_NOTICES).map((notice) => (
        <UndoToast
          key={notice.key}
          notice={notice}
          onDone={() => onDone(notice)}
          onExpire={() => onExpire(notice)}
          onUndo={() => onUndo(notice)}
        />
      ))}
    </div>
  );
}
