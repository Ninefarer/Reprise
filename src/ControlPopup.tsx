import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** A selection surface, including inside native modal dialogs. */
export function ControlPopup({ anchor, onClose, children }: {
  anchor: RefObject<HTMLElement | null>; onClose: () => void; children: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const callback = useRef(onClose); callback.current = onClose;
  const [host] = useState(() => anchor.current?.closest("dialog[open]") ?? document.body);
  useLayoutEffect(() => {
    const surface = layer.current!, box = panel.current!;
    surface.showPopover?.();
    const rect = anchor.current!.getBoundingClientRect();
    box.style.minWidth = `${Math.min(rect.width, innerWidth - 16)}px`;
    box.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - box.offsetWidth - 8))}px`;
    box.style.top = `${Math.max(8, Math.min(rect.bottom + 4, innerHeight - box.offsetHeight - 8))}px`;
    if (!box.contains(document.activeElement)) box.querySelector<HTMLElement>("button:not(:disabled), input")?.focus();
    const dismiss = () => callback.current();
    const scroll = (event: Event) => { if (!box.contains(event.target as Node)) dismiss(); };
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      surface.hidePopover?.();
      window.removeEventListener("resize", dismiss); window.removeEventListener("blur", dismiss);
      window.removeEventListener("scroll", scroll, true);
      if (box.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true });
    };
  }, [anchor]);
  return createPortal(<div ref={layer} popover={typeof HTMLElement.prototype.showPopover === "function" ? "manual" : undefined}
    className="control-shield" onPointerDown={e => { if (e.target === e.currentTarget) { anchor.current?.focus(); callback.current(); } }}
    onClick={e => { if (e.target === e.currentTarget) { anchor.current?.focus(); callback.current(); } }}
    onContextMenu={e => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); }}
    onKeyDown={e => {
      if (e.key === "Escape" || e.key === "Tab") {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
        anchor.current?.focus(); callback.current();
      }
    }}><div ref={panel} className="control-popup material-menu" data-control-popup>{children}</div></div>, host);
}
