import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./tooltips.css";

export function AppTooltips() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined;
    let target: HTMLElement | null = null;
    function dismiss() {
      clearTimeout(pending);
      target = null;
      setAnchor(null);
    }
    function schedule(element: HTMLElement, delay: number) {
      if (target === element) return;
      dismiss();
      target = element;
      pending = setTimeout(() => {
        if (element.isConnected && !element.closest("[hidden], [inert]"))
          setAnchor(element);
      }, delay);
    }
    function from(event: Event) {
      return event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-tooltip]")
        : null;
    }
    function hover(event: PointerEvent) {
      const element = from(event);
      if (element && event.pointerType !== "touch" && !event.buttons)
        schedule(element, 500);
    }
    function leave(event: PointerEvent) {
      if (
        target &&
        from(event) === target &&
        !(
          event.relatedTarget instanceof Node &&
          target.contains(event.relatedTarget)
        )
      )
        dismiss();
    }
    function focus(event: FocusEvent) {
      const element = from(event);
      if (element?.matches(":focus-visible")) schedule(element, 250);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("pointerover", hover);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", dismiss);
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("contextmenu", dismiss, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("blur", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      clearTimeout(pending);
      document.removeEventListener("pointerover", hover);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", dismiss);
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("contextmenu", dismiss, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!anchor || !tip.current) return;
    const node = tip.current;
    const rect = anchor.getBoundingClientRect();
    const { width, height } = node.getBoundingClientRect();
    const right =
      anchor.dataset.tooltipSide === "right" &&
      rect.right + width + 14 <= innerWidth;
    const left = right ? rect.right + 8 : rect.left + (rect.width - width) / 2;
    const top = right
      ? rect.top + (rect.height - height) / 2
      : rect.bottom + height + 14 <= innerHeight
        ? rect.bottom + 8
        : rect.top - height - 8;
    node.style.left = `${Math.max(6, Math.min(left, innerWidth - width - 6))}px`;
    node.style.top = `${Math.max(6, Math.min(top, innerHeight - height - 6))}px`;
    const described = anchor.getAttribute("aria-describedby");
    anchor.setAttribute(
      "aria-describedby",
      [described, node.id].filter(Boolean).join(" "),
    );
    return () => {
      const remaining = anchor
        .getAttribute("aria-describedby")
        ?.split(/\s+/)
        .filter((id) => id !== node.id);
      if (remaining?.length)
        anchor.setAttribute("aria-describedby", remaining.join(" "));
      else anchor.removeAttribute("aria-describedby");
    };
  }, [anchor]);

  if (!anchor?.dataset.tooltip) return null;
  const host = anchor.closest("dialog[open]") ?? document.body;
  return createPortal(
    <div ref={tip} id="app-tooltip" className="app-tooltip" role="tooltip">
      {anchor.dataset.tooltip}
    </div>,
    host,
  );
}
