import { useLayoutEffect, useRef, type RefObject } from "react";
import { motionAllowed, springMotion, type SpringMotion } from "./motion";

/** Reuses the existing selected fill; only its position changes. */
export function NavigationSelection({
  container,
  selection,
  layout,
}: {
  container: RefObject<HTMLElement | null>;
  selection: string;
  layout: unknown;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const controller = useRef<SpringMotion | null>(null);
  const left = useRef(0),
    initialized = useRef(false);
  const shape = useRef({ from: 0, to: 0, height: 0 });
  useLayoutEffect(() => {
    const node = marker.current!,
      nav = container.current ?? node.parentElement!;
    const place = () => {
      const selected = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected || !selected.offsetHeight || selected.closest("[hidden]")) {
        node.hidden = true;
        nav.removeAttribute("data-motion-selection");
        initialized.current = false;
        controller.current?.dispose();
        controller.current = null;
        return;
      }
      const rect = selected.getBoundingClientRect(),
        parent = nav.getBoundingClientRect();
      left.current = rect.left - parent.left + nav.scrollLeft;
      const top = rect.top - parent.top + nav.scrollTop;
      node.hidden = false;
      node.style.width = `${selected.offsetWidth}px`;
      node.style.height = `${selected.offsetHeight}px`;
      shape.current = {
        from: initialized.current ? shape.current.to : top,
        to: top,
        height: selected.offsetHeight,
      };
      if (!controller.current)
        controller.current = springMotion(
          node,
          (y) => {
            const { from, to, height } = shape.current,
              distance = to - from;
            const p = distance
              ? Math.max(0, Math.min(1, (y - from) / distance))
              : 1;
            const energy = Math.sin(p * Math.PI),
              flex = energy * Math.min(6, Math.abs(distance) * 0.04);
            return {
              transform: `translate(${left.current}px, ${y - flex / 2}px)`,
              height: `${height + flex}px`,
              borderRadius: `${6 + energy * 1.5}px`,
              boxShadow: `inset 0 1px 0 rgb(255 255 255 / ${energy * 0.18})`,
            };
          },
          "fluid",
          top,
        );
      if (!initialized.current)
        node.style.transform = `translate(${left.current}px, ${top}px)`;
      controller.current.to(top);
      initialized.current = true;
      nav.dataset.motionSelection = "true";
    };
    place();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    observer?.observe(nav);
    return () => observer?.disconnect();
  }, [container, selection, layout]);
  useLayoutEffect(() => () => controller.current?.dispose(), []);
  return (
    <span
      ref={marker}
      hidden
      className="navigation-selection"
      aria-hidden="true"
    />
  );
}

/** Bounded FLIP measurements at React commits, never on each animation frame. */
export function useTaskLayout(
  container: RefObject<HTMLElement | null>,
  scope: string,
) {
  const previous = useRef(
    new Map<
      string,
      {
        node: HTMLElement;
        top: number;
        left: number;
        rect: DOMRect;
        scrollY: number;
      }
    >(),
  );
  const currentScope = useRef(scope);
  const animations = useRef(new Map<HTMLElement, SpringMotion>());
  const ghosts = useRef(new Map<HTMLElement, SpringMotion>());
  useLayoutEffect(() => {
    const root = container.current;
    const next: typeof previous.current = new Map();
    const sameScope = currentScope.current === scope;
    currentScope.current = scope;
    const rows = Array.from(
      root?.querySelectorAll<HTMLElement>("[data-motion-task]") ?? [],
    );
    const positions = rows.map((node) => ({
      node,
      top: node.offsetTop,
      left: node.offsetLeft,
      rect: node.getBoundingClientRect(),
      scrollY: window.scrollY,
    }));
    for (const position of positions) {
      const { node, top, left } = position,
        id = node.dataset.motionTask!;
      next.set(id, position);
      const old = previous.current.get(id);
      if (!sameScope || !old || old.node !== node) {
        if (
          sameScope &&
          previous.current.size &&
          !old &&
          !node.classList.contains("completion-feedback")
        ) {
          const motion = springMotion(
            node,
            (p) => ({
              opacity: String(Math.max(0, Math.min(1, p))),
              transform: `translateY(${(1 - p) * 4}px)`,
            }),
            "decisive",
          );
          animations.current.set(node, motion);
          motion.to(1, () => animations.current.delete(node));
        }
        continue;
      }
      if (old.top === top && old.left === left) continue;
      // Capture the current visual displacement before cancelling a prior FLIP.
      const transform = getComputedStyle(node).transform;
      const matrix =
        typeof DOMMatrixReadOnly !== "undefined"
          ? new DOMMatrixReadOnly(transform === "none" ? undefined : transform)
          : null;
      const dx = old.left - left + (matrix?.m41 ?? 0),
        dy = old.top - top + (matrix?.m42 ?? 0);
      animations.current.get(node)?.dispose();
      const motion = springMotion(
        node,
        (p) => ({
          transform: `translate(${dx * (1 - p)}px, ${dy * (1 - p)}px)`,
        }),
        "decisive",
      );
      animations.current.set(node, motion);
      motion.to(1, () => animations.current.delete(node));
    }
    for (const [node, motion] of animations.current) {
      if (!sameScope || !rows.includes(node)) {
        motion.dispose();
        animations.current.delete(node);
      }
    }
    if (!sameScope) {
      ghosts.current.forEach((motion, node) => {
        motion.dispose();
        node.remove();
      });
      ghosts.current.clear();
    } else if (root && motionAllowed()) {
      for (const [id, old] of previous.current) {
        if (next.has(id) || old.node.classList.contains("completion-feedback"))
          continue;
        // Visual snapshot only: no React handlers, focus targets or live task actions.
        const ghost = old.node.cloneNode(true) as HTMLElement;
        ghost.inert = true;
        ghost.setAttribute("aria-hidden", "true");
        ghost.removeAttribute("data-motion-task");
        ghost.dataset.motionGhost = "";
        [ghost, ...Array.from(ghost.querySelectorAll("[id]"))].forEach((node) =>
          node.removeAttribute("id"),
        );
        Object.assign(ghost.style, {
          position: "fixed",
          margin: "0",
          pointerEvents: "none",
          left: `${old.rect.left}px`,
          top: `${old.rect.top + old.scrollY - window.scrollY}px`,
          width: `${old.rect.width}px`,
          height: `${old.rect.height}px`,
          zIndex: "1",
        });
        root.appendChild(ghost);
        const motion = springMotion(
          ghost,
          (p) => ({
            opacity: String(Math.max(0, Math.min(1, p))),
            transform: `translateY(${(1 - p) * -4}px)`,
          }),
          "decisive",
          1,
        );
        ghosts.current.set(ghost, motion);
        motion.to(0, () => {
          ghost.remove();
          ghosts.current.delete(ghost);
        });
      }
    }
    previous.current = next;
  });
  useLayoutEffect(() => {
    const settleGhosts = () =>
      [...ghosts.current.values()].forEach((motion) => motion.finish());
    window.addEventListener("scroll", settleGhosts, true);
    window.addEventListener("resize", settleGhosts);
    return () => {
      animations.current.forEach((motion) => motion.dispose());
      animations.current.clear();
      ghosts.current.forEach((motion, node) => {
        motion.dispose();
        node.remove();
      });
      ghosts.current.clear();
      window.removeEventListener("scroll", settleGhosts, true);
      window.removeEventListener("resize", settleGhosts);
    };
  }, []);
}
