// Explicit installed-app QA; each UI workload runs sequentially and restores preferences.
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const modulePath = process.argv[2];
const { chromium } = await import(pathToFileURL(modulePath));
const browser = await chromium.connectOverCDP("http://127.0.0.1:9228");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url() === "http://tauri.localhost/");
if (!page) throw Error("Expected installed main WebView");
const ipc = (cmd, args) =>
  page.evaluate(
    ([cmd, args]) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    [cmd, args],
  );
const settings = (await ipc("snapshot")).settings;
const fields = [
  "desktop_glass",
  "desktop_material",
  "desktop_tint",
  "theme",
  "theme_family",
  "animation",
];
const restore = Object.fromEntries(fields.map((key) => [key, settings[key]]));
const rows = [],
  errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
async function measure(name, work) {
  await page.evaluate(() => {
    const state = (window.__polishWork = {
      intervals: [],
      longTasks: [],
      previous: 0,
      frame: 0,
    });
    const frame = (now) => {
      if (state.previous) state.intervals.push(now - state.previous);
      state.previous = now;
      state.frame = requestAnimationFrame(frame);
    };
    state.frame = requestAnimationFrame(frame);
    state.observer = new PerformanceObserver((list) =>
      state.longTasks.push(...list.getEntries().map((entry) => entry.duration)),
    );
    state.observer.observe({ type: "longtask" });
  });
  const startedAt = new Date().toISOString();
  try {
    await work();
    await page.waitForTimeout(700);
  } finally {
    const finishedAt = new Date().toISOString();
    const result = await page.evaluate(() => {
      const state = window.__polishWork;
      cancelAnimationFrame(state.frame);
      state.observer.disconnect();
      const sorted = state.intervals.sort((a, b) => a - b);
      const animations = document.getAnimations().map((animation) => ({
        name: animation.animationName ?? "spring",
        state: animation.playState,
      }));
      const result = {
        frames: sorted.length,
        p95: sorted[Math.floor(sorted.length * 0.95)],
        max: sorted.at(-1),
        longTasks: state.longTasks,
        animations: animations.filter(
          (animation) =>
            animation.state === "running" && animation.name !== "undo-drain",
        ).length,
        animationStates: animations,
        undoCountdowns: animations.filter(
          (animation) => animation.name === "undo-drain",
        ).length,
        transientNodes: document.querySelectorAll(
          ".glass-morph-shell,.glass-press-surface,[data-motion-ghost]",
        ).length,
      };
      delete window.__polishWork;
      return result;
    });
    rows.push({ name, startedAt, finishedAt, ...result });
  }
}
try {
  await page.bringToFront();
  await measure("rapid-navigation", async () => {
    for (let i = 0; i < 60; i++) {
      await page
        .getByRole("navigation")
        .getByRole("button", {
          name: ["Home", "Inbox", "Daily Review", "Scheduled"][i % 4],
          exact: true,
        })
        .click();
      await page.waitForTimeout(100);
    }
  });
  await measure("theme-and-material-switching", async () => {
    for (const family of ["classic", "pitch-black", "ashen-white", "peach"])
      for (const theme of ["light", "dark"])
        for (const material of ["clear", "acrylic"])
          for (const tint of [35, 60, 90]) {
            await ipc("visual_preferences", {
              patch: {
                theme_family: family,
                theme,
                desktop_glass: true,
                desktop_material: material,
                desktop_tint: tint,
              },
            });
            await page.waitForTimeout(150);
          }
  });
  await ipc("visual_preferences", { patch: restore });
  await measure("task-workflows", async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["scripts/performance/polish-functional.mjs", modulePath],
      { windowsHide: true },
    );
    console.log(stdout.trim());
  });
  assert.deepEqual(errors, []);
  rows.forEach((row) => {
    assert.equal(row.animations, 0);
    assert.equal(row.transientNodes, 0);
  });
} finally {
  await ipc("visual_preferences", { patch: restore });
  await writeFile(
    "artifacts/polish/workloads.json",
    JSON.stringify(
      {
        rows,
        errors,
        note: "Finite rAF instrumentation; renderer scheduling, not GPU frame time.",
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(JSON.stringify(rows));
