import {
  motionAllowed,
  springMotion,
  surfaceFrame,
  type SpringMotion,
} from "./motion";

/** Top-layer popovers must be shown before choosing measured geometry. */
export function popupSurfaceMotion(
  panel: HTMLElement,
  source: () => SurfaceRect,
): SpringMotion {
  let chosen: SpringMotion | undefined;
  return {
    to(target, onRest) {
      chosen ??=
        panel.offsetWidth &&
        document.documentElement.dataset.glassFidelity !== "legacy"
          ? morphSurface(panel, source)
          : springMotion(panel, surfaceFrame);
      chosen.to(target, onRest);
    },
    finish() {
      chosen?.finish();
    },
    dispose() {
      chosen?.dispose();
    },
  };
}

export interface SurfaceRect {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
}
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export function interpolateSurface(
  a: SurfaceRect,
  b: SurfaceRect,
  progress: number,
): SurfaceRect {
  // Geometry must remain valid even when the physics has a tiny overshoot.
  const p = Math.max(0, Math.min(1, progress));
  return {
    left: mix(a.left, b.left, p),
    top: mix(a.top, b.top, p),
    width: mix(a.width, b.width, p),
    height: mix(a.height, b.height, p),
    radius: mix(a.radius, b.radius, p),
  };
}

/** A bounded DOM shell morph, not a refraction renderer. Text is never scaled. */
export function morphSurface(
  panel: HTMLElement,
  source: () => SurfaceRect,
): SpringMotion {
  let controller: SpringMotion | undefined, shell: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let current = 0;
  const restore = () => {
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    panel.removeAttribute("data-morphing");
    panel.style.removeProperty("clip-path");
    panel.style.removeProperty("opacity");
    shell?.remove();
  };
  const prepare = () => {
    if (controller) return;
    const computed = getComputedStyle(panel),
      destination = panel.getBoundingClientRect();
    const target: SurfaceRect = {
      left: destination.left,
      top: destination.top,
      width: destination.width,
      height: destination.height,
      radius: parseFloat(computed.borderTopLeftRadius) || 8,
    };
    const start = source();
    shell = document.createElement("div");
    shell.className = "glass-morph-shell";
    shell.setAttribute("aria-hidden", "true");
    shell.inert = true;
    for (const property of [
      "background",
      "border",
      "box-shadow",
      "backdrop-filter",
      "color",
    ])
      shell.style.setProperty(property, computed.getPropertyValue(property));
    panel.before(shell);
    const restingShadow =
      computed.boxShadow === "none" ? "0 0 0 transparent" : computed.boxShadow;
    controller = springMotion(
      shell,
      (value) => {
        const rect = interpolateSurface(start, target, value),
          energy = Math.sin(Math.PI * Math.max(0, Math.min(1, value)));
        return {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          borderRadius: `${rect.radius}px`,
          boxShadow: `${restingShadow}, inset 0 ${1 + energy}px 0 rgb(255 255 255 / ${energy * 0.22}), 0 ${energy * 3}px ${energy * 12}px rgb(0 0 0 / ${energy * 0.08})`,
        };
      },
      "fluid",
      current,
      [
        {
          element: panel,
          frame: (value) => {
            const r = interpolateSurface(start, target, value),
              p = Math.max(0, Math.min(1, value));
            return {
              clipPath: `inset(${r.top - target.top}px ${target.left + target.width - r.left - r.width}px ${target.top + target.height - r.top - r.height}px ${r.left - target.left}px round ${r.radius}px)`,
              opacity: String(Math.min(1, p * 4)),
              transform: "none",
            };
          },
        },
      ],
    );
    if (typeof ResizeObserver !== "undefined") {
      const width = panel.offsetWidth,
        height = panel.offsetHeight;
      resizeObserver = new ResizeObserver(() => {
        if (panel.offsetWidth !== width || panel.offsetHeight !== height)
          controller?.finish();
      });
      resizeObserver.observe(panel);
    }
  };
  return {
    to(target, onRest) {
      if (
        !motionAllowed() ||
        !panel.offsetWidth ||
        typeof panel.animate !== "function"
      ) {
        controller?.dispose();
        controller = undefined;
        current = target;
        restore();
        onRest?.();
        return;
      }
      prepare();
      panel.before(shell!);
      panel.dataset.morphing = "true";
      shell!.hidden = false;
      controller!.to(target, () => {
        current = target;
        controller?.dispose();
        controller = undefined;
        restore();
        if (!target) panel.style.opacity = "0";
        onRest?.();
      });
    },
    finish() {
      controller?.finish();
    },
    dispose() {
      controller?.dispose();
      restore();
      controller = undefined;
    },
  };
}

/** Surface-only deformation, with coordinated directional rim light. */
export function glassPressFrame(
  p: number,
  shadow = "0 0 0 transparent",
  radius = 6,
) {
  const flex = Math.max(0, Math.min(1, p));
  return {
    transform: `scale(${1 + flex * 0.006}, ${1 - flex * 0.026})`,
    borderRadius: `${radius + flex * 1.5}px`,
    boxShadow: `${shadow}, inset 0 ${1 + flex}px 0 rgb(255 255 255 / ${flex * 0.3}), inset 0 -1px 0 rgb(0 0 0 / ${flex * 0.12})`,
    opacity: "1",
  };
}

/** One real SVG silhouette for two equal-height rounded controls; no blur/metaballs. */
export function connectedControlPath(
  width: number,
  gap: number,
  height: number,
  progress: number,
  rightWidth = width,
) {
  const p = Math.max(0, Math.min(1, progress)),
    r = Math.min(6, height / 2),
    cy = height / 2,
    neck = p * (cy - r),
    bend = gap * 0.2 * p,
    x = width + gap,
    end = x + rightWidth;
  return `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${cy - neck} C ${width + gap / 2} ${cy - neck + bend} ${x - gap / 2} ${cy - neck + bend} ${x} ${cy - neck} V ${r} Q ${x} 0 ${x + r} 0 H ${end - r} Q ${end} 0 ${end} ${r} V ${height - r} Q ${end} ${height} ${end - r} ${height} H ${x + r} Q ${x} ${height} ${x} ${height - r} V ${cy + neck} C ${x - gap / 2} ${cy + neck - bend} ${width + gap / 2} ${cy + neck - bend} ${width} ${cy + neck} V ${height - r} Q ${width} ${height} ${width - r} ${height} H ${r} Q 0 ${height} 0 ${height - r} V ${r} Q 0 0 ${r} 0 Z`;
}
