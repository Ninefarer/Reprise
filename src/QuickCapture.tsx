import type { ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
export function QuickCapture({
  children,
  error,
  busy,
  onError,
}: {
  children: ReactNode;
  error: string;
  busy: boolean;
  onError: (error: string) => void;
}) {
  async function close() {
    try {
      await getCurrentWindow().hide();
    } catch (error) {
      onError(String(error));
    }
  }
  return (
    <main className="quick" aria-label="Quick Capture" aria-busy={busy}>
      <header
        className="quick-head"
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            (event.target as HTMLElement).closest("button")
          )
            return;
          void getCurrentWindow()
            .startDragging()
            .catch((error) => onError(String(error)));
        }}
      >
        <div>
          <strong>Quick Capture</strong>
          <span>Inbox</span>
        </div>
        <button
          type="button"
          className="quick-close"
          aria-label="Close Quick Capture"
          title="Close (Esc)"
          disabled={busy}
          onClick={() => void close()}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
            <path
              d="m4 4 8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </header>
      {children}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : (
        <footer className="quick-foot">
          <span>
            <kbd>Enter</kbd> save to Inbox
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </footer>
      )}
    </main>
  );
}
