import { useLayoutEffect, useRef, type ReactNode } from "react";
import { connectedControlPath } from "./glassMotion";
import { motionAllowed, springMotion, type SpringMotion } from "./motion";

/** A transient shared rim for related presets, never a global merging filter. */
export function ConnectedGlassControls({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = group.current!;
    let svg: SVGSVGElement | undefined,
      motion: SpringMotion | undefined,
      owner: HTMLElement | null = null;
    const clear = () => {
      motion?.dispose();
      motion = undefined;
      svg?.remove();
      svg = undefined;
      owner = null;
    };
    const release = () => motion?.to(0, clear);
    const press = (event: Event) => {
      if (
        !motionAllowed() ||
        document.documentElement.dataset.glassFidelity === "legacy"
      )
        return;
      if (event instanceof PointerEvent && event.button !== 0) return;
      if (
        event instanceof KeyboardEvent &&
        (event.repeat || ![" ", "Enter"].includes(event.key))
      )
        return;
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      if (!button || !root.contains(button)) return;
      if (owner === button && motion) {
        motion.to(1);
        return;
      }
      clear();
      const buttons = Array.from(
          root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        ),
        index = buttons.indexOf(button);
      const other = buttons[index + 1] ?? buttons[index - 1];
      if (!other) return;
      const first = index < buttons.indexOf(other) ? button : other,
        second = first === button ? other : button;
      const a = first.getBoundingClientRect(),
        b = second.getBoundingClientRect(),
        r = root.getBoundingClientRect(),
        gap = b.left - a.right;
      if (
        gap < 0 ||
        gap > 16 ||
        Math.abs(a.top - b.top) > 2 ||
        Math.abs(a.height - b.height) > 2
      )
        return;
      owner = button;
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const path = document.createElementNS(svg.namespaceURI, "path");
      svg.append(path);
      svg.setAttribute("aria-hidden", "true");
      svg.classList.add("connected-glass-rim");
      svg.setAttribute("width", String(b.right - a.left));
      svg.setAttribute("height", String(a.height));
      Object.assign(svg.style, {
        left: `${a.left - r.left}px`,
        top: `${a.top - r.top}px`,
      });
      root.append(svg);
      motion = springMotion(
        path as unknown as HTMLElement,
        (p) => ({
          d: `path("${connectedControlPath(a.width, gap, a.height, p, b.width)}")`,
          opacity: String(Math.max(0, Math.min(1, p)) * 0.2),
        }),
        "snappy",
      );
      motion.to(1);
    };
    const keyUp = (e: KeyboardEvent) => {
      if ([" ", "Enter"].includes(e.key)) release();
    };
    root.addEventListener("pointerdown", press);
    root.addEventListener("keydown", press);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    document.addEventListener("keyup", keyUp);
    window.addEventListener("blur", release);
    return () => {
      clear();
      root.removeEventListener("pointerdown", press);
      root.removeEventListener("keydown", press);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      document.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release);
    };
  }, []);
  return (
    <div ref={group} className={`${className} connected-glass-controls`}>
      {children}
    </div>
  );
}
