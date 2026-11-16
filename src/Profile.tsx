import { useEffect, useRef, useState } from "react";
import { platform } from "reprise:platform";
import { clamp, panCrop } from "./avatarCrop";
export function Avatar({ src, name }: { src?: string | null; name: string }) {
  return (
    <span className="avatar">
      {src ? (
        <img src={src} alt="" />
      ) : (
        <span aria-hidden="true">
          {name.trim().slice(0, 1).toUpperCase() || "R"}
        </span>
      )}
    </span>
  );
}
export function AvatarEditor({
  avatar,
  name,
  onSaved,
}: {
  avatar?: string | null;
  name: string;
  onSaved: () => Promise<void>;
}) {
  const [source, setSource] = useState<HTMLImageElement | null>(null),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    file = useRef<HTMLInputElement>(null),
    drag = useRef<{ id: number; x: number; y: number } | null>(null);
  function pan(dx: number, dy: number) {
    if (!source || !canvas.current || busy) return;
    const side = Math.min(source.naturalWidth, source.naturalHeight) / zoom;
    const bounds = canvas.current.getBoundingClientRect();
    setX((value) =>
      panCrop(value, dx, source.naturalWidth, side, bounds.width),
    );
    setY((value) =>
      panCrop(value, dy, source.naturalHeight, side, bounds.height),
    );
  }
  function endDrag() {
    drag.current = null;
    setDragging(false);
  }
  useEffect(() => {
    const preview = canvas.current;
    if (!source || !preview) return;
    const wheel = (event: WheelEvent) => {
      if (busy || drag.current || event.deltaY === 0) return;
      event.preventDefault();
      setZoom((value) => clamp(value + (event.deltaY < 0 ? 0.1 : -0.1), 1, 4));
    };
    preview.addEventListener("wheel", wheel, { passive: false });
    return () => preview.removeEventListener("wheel", wheel);
  }, [source, busy]);
  useEffect(() => {
    if (!source || !canvas.current) return;
    const ctx = canvas.current.getContext("2d")!;
    const side = Math.min(source.naturalWidth, source.naturalHeight) / zoom;
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(
      source,
      ((source.naturalWidth - side) * x) / 100,
      ((source.naturalHeight - side) * y) / 100,
      side,
      side,
      0,
      0,
      256,
      256,
    );
  }, [source, zoom, x, y]);
  async function save(remove = false) {
    setBusy(true);
    try {
      await platform.saveAvatar(
        remove ? null : canvas.current!.toDataURL("image/png").split(",")[1],
      );
      setSource(null);
      setError("");
      await onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="avatar-editor">
      <div className="avatar-row">
        <Avatar src={avatar} name={name} />
        <button type="button" onClick={() => file.current?.click()}>
          {avatar ? "Replace avatar" : "Choose avatar"}
        </button>
        {avatar && (
          <button type="button" disabled={busy} onClick={() => void save(true)}>
            Remove avatar
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 10 * 1024 * 1024) {
              setError("Choose an image smaller than 10 MB.");
              return;
            }
            try {
              const bitmap = await createImageBitmap(f);
              if (bitmap.width > 8192 || bitmap.height > 8192) {
                bitmap.close();
                throw Error("Choose an image no larger than 8192 × 8192.");
              }
              const url = URL.createObjectURL(f);
              const img = new Image();
              img.onload = () => {
                URL.revokeObjectURL(url);
                setSource(img);
                setZoom(1);
                setX(50);
                setY(50);
                setError("");
              };
              img.onerror = () => {
                URL.revokeObjectURL(url);
                setError(
                  "This image could not be read. Choose PNG, JPEG or WebP.",
                );
              };
              img.src = url;
              bitmap.close();
            } catch (e) {
              setError(String(e));
            }
          }}
        />
      </div>
      {source && (
        <fieldset disabled={busy}>
          <legend>Crop your avatar</legend>
          <canvas
            ref={canvas}
            width={256}
            height={256}
            aria-label="Profile avatar crop preview"
            role="application"
            aria-roledescription="image crop editor"
            aria-describedby="avatar-crop-help"
            tabIndex={busy ? -1 : 0}
            data-dragging={dragging}
            onPointerDown={(e) => {
              if (busy || !e.isPrimary || e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.focus();
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const previous = drag.current;
              if (!previous || previous.id !== e.pointerId) return;
              pan(e.clientX - previous.x, e.clientY - previous.y);
              drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              if (drag.current?.id !== e.pointerId) return;
              endDrag();
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onKeyDown={(e) => {
              if (busy) return;
              const step = e.shiftKey ? 30 : 10;
              const movement: Record<string, [number, number]> = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              };
              if (movement[e.key]) {
                e.preventDefault();
                pan(...movement[e.key]);
              } else if (["+", "=", "-"].includes(e.key)) {
                e.preventDefault();
                setZoom((value) =>
                  clamp(value + (e.key === "-" ? -0.1 : 0.1), 1, 4),
                );
              }
            }}
          />
          <p className="hint" id="avatar-crop-help">
            Drag the image to position it. Scroll to zoom, or use the buttons
            below. Arrow keys move the image; + and − zoom.
          </p>
          <div
            className="avatar-crop-tools"
            role="group"
            aria-label="Crop zoom"
          >
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= 1}
              onClick={() => setZoom((value) => clamp(value - 0.1, 1, 4))}
            >
              −
            </button>
            <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= 4}
              onClick={() => setZoom((value) => clamp(value + 0.1, 1, 4))}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                endDrag();
                setZoom(1);
                setX(50);
                setY(50);
              }}
            >
              Reset crop
            </button>
          </div>
          <div className="dialog-actions">
            <button type="button" disabled={busy} onClick={() => void save()}>
              Save avatar
            </button>
            <button type="button" onClick={() => setSource(null)}>
              Cancel crop
            </button>
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
