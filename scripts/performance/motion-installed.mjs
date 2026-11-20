// Explicit installed-WebView QA. No task mutations; original visual preferences restored.
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const [modulePath, label = "motion", mode = "interactions"] =
  process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label)) throw Error("Invalid label");
const { chromium } = await import(pathToFileURL(modulePath));
const browser = await chromium.connectOverCDP("http://127.0.0.1:9228");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url() === "http://tauri.localhost/");
if (!page) throw Error("Expected installed Tauri main window");
const ipc = (cmd, args) =>
  page.evaluate(
    ([cmd, args]) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    [cmd, args],
  );
const original = (await ipc("snapshot")).settings;
const fields = [
  "theme",
  "theme_family",
  "desktop_glass",
  "desktop_material",
  "desktop_tint",
  "animation",
];
const restore = Object.fromEntries(fields.map((k) => [k, original[k]]));
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const rows = [];
await mkdir("artifacts/motion", { recursive: true });
try {
  await page.bringToFront();
  console.log(
    await page.evaluate(() => ({
      active: document.documentElement.dataset.windowActive,
      dialogs: [...document.querySelectorAll("dialog[open]")].map(
        (el) => el.getAttribute("aria-label") || el.textContent.slice(0, 70),
      ),
      shields: document.querySelectorAll(".control-shield,.menu-shield").length,
      notifications: !!document.querySelector(".notification-dock"),
    })),
  );
  if (mode === "quit") {
    await ipc("quit_app");
    process.exit(0);
  }
  if (await page.locator(".notification-dock").count()) {
    await page.locator(".notification-dock").focus();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => {
    window.__motionQA = { frames: [], long: [], events: 0 };
    const q = window.__motionQA;
    let last = performance.now();
    q.frame = requestAnimationFrame(function sample(now) {
      q.frames.push(now - last);
      last = now;
      q.frame = requestAnimationFrame(sample);
    });
    q.observer = new PerformanceObserver((list) =>
      q.long.push(...list.getEntries().map((e) => e.duration)),
    );
    q.observer.observe({ type: "longtask" });
    q.count = () => q.events++;
    document.addEventListener("pointerdown", q.count, true);
  });
  for (let i = 0; i < 5; i++) {
    const category = page.getByRole("combobox", {
      name: "Category",
      exact: true,
    });
    if (!(await category.count())) await page.keyboard.press("Control+Shift+n");
    await category.waitFor();
    await category.click();
    await page.keyboard.press("Escape");
    await category.click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(650);
  assert.equal(await page.locator(".control-popup").count(), 0);
  assert.equal(await page.locator(".notification-dock").count(), 0);
  for (const name of ["Inbox", "Daily Review", "Home", "Scheduled", "Home"]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  }
  await page.waitForTimeout(650);
  rows.push({
    interactionCycles: 5,
    remainingAnimations: await page.evaluate(
      () => document.getAnimations().length,
    ),
  });
  if (mode === "matrix") {
    for (const family of ["classic", "pitch-black", "ashen-white", "peach"])
      for (const theme of ["light", "dark"])
        for (const material of ["clear", "acrylic"]) {
          await ipc("visual_preferences", {
            patch: {
              theme_family: family,
              theme,
              desktop_glass: true,
              desktop_material: material,
              animation: "expressive",
            },
          });
          await page.waitForTimeout(120);
          await page.keyboard.press("Control+Shift+n");
          await page
            .getByRole("combobox", { name: "Category", exact: true })
            .click();
          await page.waitForTimeout(500);
          rows.push(
            await page.evaluate(() => {
              const el = document.querySelector(".control-popup"),
                c = getComputedStyle(el),
                r = el.getBoundingClientRect();
              return {
                family: document.documentElement.dataset.family,
                theme: document.documentElement.dataset.theme,
                material: document.documentElement.dataset.glassVariant,
                opacity: c.opacity,
                transform: c.transform,
                inViewport:
                  r.left >= 0 &&
                  r.right <= innerWidth &&
                  r.top >= 0 &&
                  r.bottom <= innerHeight,
              };
            }),
          );
          await page.keyboard.press("Escape");
          await page.keyboard.press("Escape");
        }
    await ipc("visual_preferences", { patch: { animation: "off" } });
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+Shift+n");
    await page.getByRole("combobox", { name: "Category", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".notification-dock").count(), 0);
    rows.push({
      reducedMotion: "off",
      remainingAnimations: await page.evaluate(
        () => document.getAnimations().length,
      ),
    });
  }
  const metrics = await page.evaluate(() => {
    const q = window.__motionQA;
    cancelAnimationFrame(q.frame);
    q.observer.disconnect();
    document.removeEventListener("pointerdown", q.count, true);
    const frames = q.frames.sort((a, b) => a - b);
    return {
      frameIntervals: {
        count: frames.length,
        p50: frames[Math.floor(frames.length * 0.5)],
        p95: frames[Math.floor(frames.length * 0.95)],
        max: frames.at(-1),
      },
      longTasks: q.long,
      pointerEvents: q.events,
    };
  });
  assert.deepEqual(errors, []);
  await writeFile(
    `artifacts/motion/${label}.json`,
    JSON.stringify(
      {
        label,
        rows,
        metrics,
        errors,
        notes:
          "Frame intervals measure renderer scheduling, not presented frames.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ label, rows, metrics, errors }));
} finally {
  await page
    .evaluate(() => {
      const q = window.__motionQA;
      if (q) {
        cancelAnimationFrame(q.frame);
        q.observer?.disconnect();
        document.removeEventListener("pointerdown", q.count, true);
        delete window.__motionQA;
      }
    })
    .catch(() => {});
  await ipc("visual_preferences", { patch: restore });
  await browser.close();
}
