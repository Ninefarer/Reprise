import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState } from "react";
import "./window.css";

const actions = [
  {
    label: "Minimize",
    path: "M4 12h8",
    run: () => getCurrentWindow().minimize(),
  },
  {
    label: "Maximize or restore",
    path: "M4 4h8v8H4z",
    run: () => getCurrentWindow().toggleMaximize(),
  },
  {
    label: "Close window",
    path: "m4 4 8 8m0-8-8 8",
    run: () => getCurrentWindow().close(),
  },
];

export function WindowControls() {
  const [error, setError] = useState("");
  return (
    <div
      className="window-edge"
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as Element).closest("button"))
          return;
        void getCurrentWindow()
          .startDragging()
          .catch(() => {
            setError("Could not move the window.");
          });
      }}
    >
      <div className="window-chrome" role="group" aria-label="Window controls">
        <div
          className="window-drag"
          onDoubleClick={() => {
            void getCurrentWindow()
              .toggleMaximize()
              .catch(() => {
                setError("Could not maximize or restore.");
              });
          }}
          title="Drag to move the window"
        />
        {error && (
          <span className="window-error" role="alert">
            {error}
          </span>
        )}
        {actions.map(({ label, path, run }) => (
          <button
            type="button"
            key={label}
            title={label}
            aria-label={label}
            onClick={async () => {
              setError("");
              try {
                await run();
              } catch {
                setError(`Could not ${label.toLowerCase()}.`);
              }
            }}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
            >
              <path d={path} />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
