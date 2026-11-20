import { useLayoutEffect, useRef, useState } from "react";
import { Select } from "./Select";
import { DateTimeField } from "./DateTimeField";
import { PopupMenu } from "./PopupMenu";
import "./context-menu.css";
import { useTactileControls } from "./useMotion";
import { connectedControlPath } from "./glassMotion";
import { springMotion } from "./motion";
import "./style.css";
import "./visual-system.css";
import "./motion.css";
import "./glass-material.css";
import "./glass-motion.css";
import "./glass-motion-lab.css";

/** Storage-free comparison; no Tauri IPC, task data, or application state. */
export function GlassMotionLab() {
  const [fidelity, setFidelity] = useState(true),
    [reduced, setReduced] = useState(false),
    [joined, setJoined] = useState(false),
    [selection, setSelection] = useState("today");
  const path = useRef<SVGPathElement>(null);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const [reviewTime,setReviewTime]=useState("2026-02-15T09:00");
  useTactileControls();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("glass-scope");
    root.dataset.theme = "dark";
    root.dataset.motion = reduced ? "off" : "expressive";
    root.dataset.glassFidelity = fidelity ? "on" : "legacy";
    return () => {
      root.classList.remove("glass-scope");
      for (const key of ["theme", "motion", "glassFidelity"])
        delete root.dataset[key];
    };
  }, [fidelity, reduced]);
  const controller = useRef<ReturnType<typeof springMotion> | null>(null);
  useLayoutEffect(() => {
    controller.current = springMotion(
      path.current as unknown as HTMLElement,
      (p) => ({ d: `path("${connectedControlPath(120, 10, 38, p)}")` }),
      "fluid",
    );
    return () => controller.current?.dispose();
  }, []);
  useLayoutEffect(() => {
    controller.current?.to(joined ? 1 : 0);
  }, [joined]);
  return (
    <main className="glass-motion-lab">
      <h1>Glass surface motion comparison</h1>
      <p>
        Actual rounded-rectangle interpolation and a shared SVG silhouette.
        Lighting is simulated; no optical refraction.
      </p>
      <label>
        <input
          type="checkbox"
          checked={fidelity}
          onChange={(e) => setFidelity(e.target.checked)}
        />{" "}
        Surface fidelity (off: previous scale/fade)
      </label>
      <label>
        <input
          type="checkbox"
          checked={reduced}
          onChange={(e) => setReduced(e.target.checked)}
        />{" "}
        Reduced motion
      </label>
      <section className="motion-sample">
        <h2>Button → menu</h2>
        <label>
          Plan
          <Select
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="later">Later</option>
            <option value="week">This week</option>
          </Select>
        </label>
      </section>
      <section className="motion-sample">
        <h2>Related controls</h2>
        <p>
          One changing SVG silhouette; no filter-based metaballs. Boundaries
          remain separate buttons.
        </p>
        <div className="connected-sample">
          <svg width="250" height="38" aria-hidden="true">
            <path ref={path} d={connectedControlPath(120, 10, 38, 0)} />
          </svg>
          <button aria-pressed={joined} onClick={() => setJoined(!joined)}>
            Group
          </button>
          <button aria-pressed={!joined} onClick={() => setJoined(!joined)}>
            Separate
          </button>
        </div>
      </section>
      <section className="motion-sample">
        <h2>Press → release</h2>
        <button className="glass-surface glass-control">
          Hold to flex surface
        </button>
        <p>
          Label geometry remains unchanged. The surface flex and rim light share
          one state.
        </p>
        <button
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setContext({ x: r.left, y: r.bottom });
          }}
        >
          Open context menu
        </button>
        {context && (
          <PopupMenu
            label="Context study"
            x={context.x}
            y={context.y}
            request={context}
            actions={[{ id: "keep", label: "Keep", onSelect: () => {} }]}
            onClose={() => setContext(null)}
          />
        )}
      </section>
      <section className="motion-sample"><h2>Picker lifecycle</h2><DateTimeField aria-label="Review time" type="datetime-local" value={reviewTime} onChange={event=>setReviewTime(event.target.value)}/></section>
    </main>
  );
}
