import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { clamp } from "./avatarCrop";
import type { ProfileCardFinish } from "./model";
import { Avatar } from "./Profile";
import "./profile-card.css";

const finishes: Record<ProfileCardFinish, string> = {
  classic: "Classic",
  holographic: "Holographic",
  polychrome: "Polychrome",
  prismatic: "Prismatic",
};
const maxTilt = 12;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const countFormat = new Intl.NumberFormat();

function useCardTilt(enabled: boolean) {
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !stage.current || !card.current) return;
    const surface = stage.current;
    const face = card.current;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const hover = matchMedia("(any-hover: hover)");
    let x = 0,
      y = 0,
      targetX = 0,
      targetY = 0;
    let frame: number | null = null;
    let lastTime: number | null = null;

    function reset() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = lastTime = null;
      x = y = targetX = targetY = 0;
      face.style.removeProperty("--tilt-x");
      face.style.removeProperty("--tilt-y");
      face.style.removeProperty("--light-x");
      face.style.removeProperty("--light-y");
    }
    function animate(time: number) {
      frame = null;
      const elapsed = lastTime === null ? 16 : time - lastTime;
      const smoothing = 1 - Math.exp(-elapsed / 62);
      x += (targetX - x) * smoothing;
      y += (targetY - y) * smoothing;
      const settled =
        Math.abs(targetX - x) < 0.002 && Math.abs(targetY - y) < 0.002;
      if (settled) {
        x = targetX;
        y = targetY;
      }
      if (settled && x === 0 && y === 0) {
        reset();
        return;
      }
      // Tilt and light use the same interpolated position.
      face.style.setProperty("--tilt-x", `${y * maxTilt}deg`);
      face.style.setProperty("--tilt-y", `${-x * maxTilt}deg`);
      face.style.setProperty("--light-x", `${50 + x * 42}%`);
      face.style.setProperty("--light-y", `${40 + y * 38}%`);
      lastTime = settled ? null : time;
      if (!settled) schedule();
    }
    function schedule() {
      if (frame === null) frame = requestAnimationFrame(animate);
    }
    function move(event: PointerEvent) {
      if (
        motion.matches ||
        !hover.matches ||
        document.hidden ||
        event.pointerType === "touch"
      )
        return;
      // Measure the stationary hit area, so the rotation cannot move its own origin.
      const { left, top, width, height } = surface.getBoundingClientRect();
      if (!width || !height) return;
      const nextX = clamp((2 * (event.clientX - left)) / width - 1, -1, 1);
      const nextY = clamp((2 * (event.clientY - top)) / height - 1, -1, 1);
      if (nextX === targetX && nextY === targetY) return;
      targetX = nextX;
      targetY = nextY;
      schedule();
    }
    function leave() {
      if (targetX === 0 && targetY === 0) return;
      targetX = targetY = 0;
      schedule();
    }
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", leave);
    surface.addEventListener("pointercancel", leave);
    motion.addEventListener("change", reset);
    hover.addEventListener("change", reset);
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("blur", reset);
    return () => {
      reset();
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", leave);
      surface.removeEventListener("pointercancel", leave);
      motion.removeEventListener("change", reset);
      hover.removeEventListener("change", reset);
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("blur", reset);
    };
  }, [enabled]);

  return { stage, card };
}

export function ProfileCardDialog({
  name,
  avatar,
  finish,
  now,
  motionEnabled,
  onFinishChange,
  onClose,
}: {
  name: string;
  avatar?: string | null;
  finish: ProfileCardFinish;
  now: number;
  motionEnabled: boolean;
  onFinishChange: (finish: ProfileCardFinish) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const { stage, card } = useCardTilt(motionEnabled);
  const [selection, setSelection] = useState(finish);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [count, setCount] = useState<number | "unavailable" | null>(null);
  const today = new Date(now * 1000);
  const displayName = name.trim() || "Reprise user";

  useEffect(() => {
    const modal = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    modal.showModal();
    return () => {
      if (modal.isConnected) modal.close();
      trigger?.focus();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void invoke<number>("profile_completion_count").then(
      (total) => {
        if (!cancelled) setCount(total);
      },
      () => {
        if (!cancelled) setCount("unavailable");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function chooseFinish(next: ProfileCardFinish) {
    if (saving || next === selection) return;
    const previous = selection;
    setSelection(next);
    setSaving(true);
    setSaveFailed(false);
    if (!(await onFinishChange(next).catch(() => false))) {
      setSelection(previous);
      setSaveFailed(true);
    }
    setSaving(false);
  }

  return (
    <dialog
      ref={dialog}
      className="task-dialog material-floating profile-card-dialog"
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="profile-card-dialog-head">
        <h2 id={heading}>Profile card</h2>
        <button type="button" autoFocus onClick={onClose}>
          Close
        </button>
      </header>
      <div ref={stage} className="profile-card-stage">
        <article ref={card} className="profile-card" data-finish={selection}>
          <div className="profile-card-portrait">
            <span className="profile-card-wordmark">Reprise</span>
            <Avatar src={avatar} name={name} />
          </div>
          <div className="profile-card-identity">
            <h3>{displayName}</h3>
            <dl className="profile-card-details">
              <div>
                <dt>Tasks completed</dt>
                <dd>
                  {typeof count === "number"
                    ? countFormat.format(count)
                    : count === null
                      ? "Loading…"
                      : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>
                  <time dateTime={today.toISOString()}>
                    {dateFormat.format(today)}
                  </time>
                </dd>
              </div>
            </dl>
          </div>
        </article>
      </div>
      <fieldset className="profile-card-finishes" aria-busy={saving}>
        <legend>Card finish</legend>
        <div className="profile-card-options">
          {(Object.keys(finishes) as ProfileCardFinish[]).map((option) => (
            <label key={option} className="profile-card-option">
              <input
                className="sr-only"
                type="radio"
                name="profile-card-finish"
                checked={selection === option}
                aria-disabled={saving}
                onChange={() => void chooseFinish(option)}
              />
              <span>
                <i data-finish={option} aria-hidden="true" />
                {finishes[option]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {saveFailed && (
        <p className="error" role="alert">
          Couldn’t save the card finish.
        </p>
      )}
    </dialog>
  );
}
