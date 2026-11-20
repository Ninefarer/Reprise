import { useLayoutEffect, useState } from "react";
import { Select } from "./Select";
import "./style.css";
import "./visual-system.css";
import "./accents.css";
import "./motion.css";
import "./glass-material.css";
import "./glass-lab.css";

/** Storage-free development harness. Never mounts Application or native commands. */
export function GlassLab() {
  const [dark, setDark] = useState(true);
  const [family, setFamily] = useState("classic");
  const [solid, setSolid] = useState(false);
  const [motion, setMotion] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState("today");
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("glass-scope");
    root.dataset.theme =
      family === "pitch-black" || (family !== "ashen-white" && dark)
        ? "dark"
        : "light";
    root.dataset.family = family;
    root.dataset.motion = motion ? "subtle" : "off";
    root.dataset.effects = solid ? "reduced" : "allowed";
    return () => {
      root.classList.remove("glass-scope");
      for (const key of ["theme", "family", "motion", "effects"])
        delete root.dataset[key];
    };
  }, [dark, family, solid, motion]);
  return (
    <main
      className="glass-lab glass-scope"
      data-glass-solid={solid}
      data-glass-motion={motion ? "on" : "off"}
    >
      <h1>Material study</h1>
      <p>
        Reprise controls over a synthetic contrast stress background. Desktop
        composition requires a native window check.
      </p>
      <div className="lab-options">
        <label>
          <input
            type="checkbox"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />{" "}
          Dark appearance
        </label>
        <label>
          <input
            type="checkbox"
            checked={solid}
            onChange={(e) => setSolid(e.target.checked)}
          />{" "}
          Solid fallback
        </label>
        <label>
          <input
            type="checkbox"
            checked={!motion}
            onChange={(e) => setMotion(!e.target.checked)}
          />{" "}
          Reduce motion
        </label>
        <label>
          Theme{" "}
          <select
            aria-label="Theme"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          >
            <option value="classic">Classic</option>
            <option value="peach">Peach</option>
            <option value="pitch-black">Pitch Black</option>
            <option value="ashen-white">Ashen White</option>
          </select>
        </label>
      </div>
      <div className="lab-stress">
        {(["clear", "regular", "tinted"] as const).map((variant) => (
          <section
            className="glass-scope lab-sample"
            data-glass-variant={variant}
            key={variant}
          >
            <h2>{variant}</h2>
            <div className="glass-surface lab-panel">
              <strong>Capture an intention</strong>
              <p>Review the project at 14:30</p>
            </div>
            <button className="glass-surface glass-control">
              Quick Capture
            </button>
          </section>
        ))}
        <section className="lab-sample">
          <h2>Legacy Clear · 35%</h2>
          <div className="lab-legacy">
            <strong>Capture an intention</strong>
            <p>Review the project at 14:30</p>
          </div>
        </section>
      </div>
      <section
        className="lab-interactive glass-scope"
        data-glass-variant="regular"
      >
        <h2>Connected controls</h2>
        <label>
          Schedule{" "}
          <Select
            aria-label="Schedule"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="later">Later this week</option>
          </Select>
        </label>
        <button
          className="glass-surface glass-control"
          aria-expanded={expanded}
          aria-controls="lab-details"
          onClick={() => setExpanded(!expanded)}
        >
          Capture options
        </button>
        <div
          className="lab-expansion"
          data-open={expanded}
          id="lab-details"
          inert={!expanded}
        >
          <div>
            <div className="glass-surface lab-panel">
              <strong>Quick Capture</strong>
              <p>Shared edge, aligned geometry, interruptible expansion.</p>
              <button onClick={() => setExpanded(false)}>Done</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
