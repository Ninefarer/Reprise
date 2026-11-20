import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useSurfacePresence } from "./useMotion";
import { morphSurface } from "./glassMotion";
import { springMotion, surfaceFrame } from "./motion";
import "./glass-motion.css";

function positionPopup(box: HTMLElement, trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  box.style.minWidth = `${Math.min(rect.width, innerWidth - 16)}px`;
  box.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - box.offsetWidth - 8))}px`;
  box.style.top = `${Math.max(8, Math.min(rect.bottom + 4, innerHeight - box.offsetHeight - 8))}px`;
}

/** A selection surface, including inside native modal dialogs. */
export function ControlPopup({
  anchor,
  open = true,
  onClose,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const callback = useRef(onClose);
  callback.current = onClose;
  const factory = useCallback(
    (box: HTMLDivElement) => {
      layer.current?.showPopover?.();
      positionPopup(box, anchor.current!);
      if (
        document.documentElement.dataset.glassFidelity === "legacy" ||
        !box.offsetWidth
      )
        return springMotion(box, surfaceFrame);
      return morphSurface(box, () => {
        const r = anchor.current!.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          radius:
            parseFloat(getComputedStyle(anchor.current!).borderTopLeftRadius) ||
            6,
        };
      });
    },
    [anchor],
  );
  const present = useSurfacePresence(
    open,
    panel,
    "fluid",
    surfaceFrame,
    factory,
  );
  const host =
    anchor.current?.closest("dialog[open], .setup-screen") ?? document.body;
  useLayoutEffect(() => {
    if (!present) return;
    const surface = layer.current!,
      box = panel.current!;
    surface.showPopover?.();
    const rect = anchor.current!.getBoundingClientRect();
    positionPopup(box, anchor.current!);
    // Expansion stays connected to its trigger even when clamped above it.
    box.style.setProperty(
      "--popup-origin",
      `${Math.max(0, Math.min(box.offsetWidth, rect.left + rect.width / 2 - parseFloat(box.style.left)))}px ${parseFloat(box.style.top) < rect.top ? "100%" : "0px"}`,
    );
    if (!box.contains(document.activeElement))
      box.querySelector<HTMLElement>("button:not(:disabled), input")?.focus();
    const dismiss = () => callback.current();
    const scroll = (event: Event) => {
      if (!box.contains(event.target as Node)) dismiss();
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      surface.hidePopover?.();
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("scroll", scroll, true);
      if (box.contains(document.activeElement))
        anchor.current?.focus({ preventScroll: true });
    };
  }, [anchor, present]);
  useLayoutEffect(() => {
    if (!present) return;
    const box = panel.current!;
    if (!open && box.contains(document.activeElement))
      anchor.current?.focus({ preventScroll: true });
    if (open && !box.contains(document.activeElement))
      box
        .querySelector<HTMLElement>("button:not(:disabled), input")
        ?.focus({ preventScroll: true });
  }, [open, present, anchor]);
  if (!present) return null;
  return createPortal(
    <div
      ref={layer}
      popover={
        typeof HTMLElement.prototype.showPopover === "function"
          ? "manual"
          : undefined
      }
      className="control-shield"
      data-closing={!open || undefined}
      inert={!open}
      aria-hidden={!open || undefined}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          anchor.current?.focus();
          callback.current();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          anchor.current?.focus();
          callback.current();
        }
      }}
      onContextMenu={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Tab") {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
          }
          anchor.current?.focus();
          callback.current();
        }
      }}
    >
      <div
        ref={panel}
        className="control-popup material-menu glass-surface"
        data-control-popup
        data-spring-surface
      >
        {children}
      </div>
    </div>,
    host,
  );
}
