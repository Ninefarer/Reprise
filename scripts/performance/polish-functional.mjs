// Temporary tasks are strictly owned by this test; original tasks are never edited.
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const { chromium } = await import(pathToFileURL(process.argv[2])),
  browser = await chromium.connectOverCDP("http://127.0.0.1:9228");
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url() === "http://tauri.localhost/");
if (!page) throw Error("Expected packaged Nightly");
const ipc = (cmd, args) =>
  page.evaluate(
    ([cmd, args]) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    [cmd, args],
  );
const original = (await ipc("snapshot")).tasks,
  originalIds = new Set(original.map((t) => t.id)),
  created = [];
const fingerprint = (tasks) =>
  createHash("sha256")
    .update(JSON.stringify(tasks.sort((a, b) => a.id.localeCompare(b.id))))
    .digest("hex");
const before = fingerprint(original),
  prefix = `QA polish ${randomUUID().slice(0, 8)}`,
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(String(e)));
const navigate = (name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name: new RegExp(`^${name}(?:\\s|$)`) })
    .click();
const status = async (id, want) => {
  for (let i = 0; i < 100; i++) {
    const task = (await ipc("snapshot")).tasks.find((t) => t.id === id);
    if (task?.status === want) return task;
    await page.waitForTimeout(50);
  }
  throw Error(`Task did not enter ${want}`);
};
try {
  await page.bringToFront();
  for (const suffix of ["finish", "snooze", "schedule"])
    created.push(await ipc("capture", { title: `${prefix} ${suffix}` }));
  await navigate("Inbox");
  await page
    .getByRole("button", { name: `Finish ${created[0].title}`, exact: true })
    .click();
  await status(created[0].id, "Finished");
  checks.push("finish persisted");
  await page
    .getByRole("button", { name: created[1].title, exact: true })
    .click();
  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Snoozed", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await status(created[1].id, "Snoozed");
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  checks.push("snooze saved");
  await navigate("Snoozed");
  await page
    .getByRole("button", { name: created[1].title, exact: true })
    .click();
  await page.getByRole("button", { name: "Settle", exact: true }).click();
  await status(created[1].id, "Settled");
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  checks.push("settle saved");
  await navigate("Inbox");
  await page
    .getByRole("button", { name: created[2].title, exact: true })
    .click();
  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Scheduled", exact: true }).click();
  await page
    .getByLabel("Scheduled start", { exact: true })
    .fill("March 3, 2030 at 9am");
  await page.getByLabel("Notes", { exact: true }).click();
  await page
    .getByRole("button", { name: "Choose date and time for Scheduled start" })
    .click();
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Date and time picker", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.waitForTimeout(450);
  await mkdir("artifacts/polish", { recursive: true });
  await page.screenshot({ path: "artifacts/polish/task-dialog.png" });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await status(created[2].id, "Scheduled");
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  checks.push("schedule and picker saved");
  await navigate("Daily Review");
  await navigate("Scheduled");
  await page.getByLabel("Search tasks", { exact: true }).fill(prefix);
  assert.equal(await page.locator("[data-motion-task]").count(), 1);
  await page.getByLabel("Search tasks", { exact: true }).fill("");
  checks.push("search and review navigation");
  await page.waitForTimeout(700);
  assert.equal(
    await page
      .locator(".glass-morph-shell,.glass-press-surface,[data-motion-ghost]")
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
} finally {
  await page.keyboard.press("Escape").catch(() => {});
  for (const owned of created) {
    assert.ok(!originalIds.has(owned.id) && owned.title.startsWith(prefix));
    const task = (await ipc("snapshot")).tasks.find((t) => t.id === owned.id);
    if (task) {
      const token = await ipc("delete_task", {
        id: task.id,
        expectedUpdatedAt: task.updated_at,
      });
      await ipc("finalize_deletion", { token });
    }
  }
  const after = (await ipc("snapshot")).tasks;
  assert.equal(fingerprint(after), before, "Original tasks changed");
  await writeFile(
    "artifacts/polish/functional.json",
    JSON.stringify(
      {
        checks,
        errors,
        temporaryTasks: created.length,
        originalTasksPreserved: true,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    checks,
    errors,
    temporaryTasks: created.length,
    originalTasksPreserved: true,
  }),
);
