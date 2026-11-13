import { useLayoutEffect, useRef, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
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
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined" || !root.current) return;
    let lastHeight = 0;
    const resize = () => {
      const height = Math.max(
        96,
        Math.min(
          360,
          Math.ceil(root.current?.getBoundingClientRect().height ?? 0),
        ),
      );
      if (height === lastHeight) return;
      lastHeight = height;
      void getCurrentWindow()
        .setSize(new LogicalSize(window.innerWidth, height))
        .catch((error) => onError(String(error)));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root.current);
    resize();
    return () => observer.disconnect();
  }, [onError]);
  async function close() {
    try {
      await getCurrentWindow().hide();
    } catch (error) {
      onError(String(error));
    }
  }
  return (
    <main
      ref={root}
      className="quick"
      aria-label="Quick Capture"
      aria-busy={busy}
    >
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
        </div>
        <button
          type="button"
          className="quick-close"
          aria-label="Close Quick Capture"
          title="Close Quick Capture"
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
      ) : null}
    </main>
  );
}
