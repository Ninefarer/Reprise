import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
    [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    file = useRef<HTMLInputElement>(null);
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
      await invoke("save_avatar", {
        pngBase64: remove
          ? null
          : canvas.current!.toDataURL("image/png").split(",")[1],
      });
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
        <fieldset>
          <legend>Crop your avatar</legend>
          <canvas
            ref={canvas}
            width={256}
            height={256}
            aria-label="Profile avatar crop preview"
          />
          <label>
            Zoom
            <input
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <label>
            Horizontal position
            <input
              type="range"
              min="0"
              max="100"
              value={x}
              onChange={(e) => setX(Number(e.target.value))}
            />
          </label>
          <label>
            Vertical position
            <input
              type="range"
              min="0"
              max="100"
              value={y}
              onChange={(e) => setY(Number(e.target.value))}
            />
          </label>
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
