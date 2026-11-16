import { expect, test, webkit, devices, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { defaultBrowserType: _browser, ...iphone } = devices["iPhone 15"];

async function openApp(page: Page) {
  await page.goto("/Reprise/");
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.getByRole("button", { name: "Continue to Nightly" }).click();
  await page.getByRole("navigation", { name: "Sections" }).waitFor();
}

async function addTask(page: Page, title: string) {
  await page.getByRole("textbox", { name: "Capture a task" }).fill(title);
  await page.getByRole("button", { name: "Add to Inbox" }).click();
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page.getByText(title).first()).toBeVisible();
}

async function openBackup(page: Page) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel(/Profile menu for/).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Export backup" })).toBeVisible();
}

async function backupOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 852 });
  const box = await page.evaluate(() => {
    const root = document.documentElement;
    const section = document.querySelector(".web-backup");
    if (!section) return null;
    const rect = section.getBoundingClientRect();
    const controls = [...section.querySelectorAll("button, input")].map((el) => {
      const bounds = el.getBoundingClientRect();
      return {
        name: el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName,
        right: bounds.right,
        height: bounds.height,
        fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
        type: el.getAttribute("type"),
      };
    });
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      sectionRight: rect.right,
      controls,
    };
  });
  expect(box, `backup controls at ${width}px`).not.toBeNull();
  expect(box!.scrollWidth).toBeLessThanOrEqual(box!.clientWidth + 1);
  expect(box!.sectionRight).toBeLessThanOrEqual(box!.clientWidth + 1);
  for (const control of box!.controls) {
    expect(control.right, control.name).toBeLessThanOrEqual(box!.clientWidth + 1);
    if (control.type === "file") {
      expect(control.fontSize).toBeGreaterThanOrEqual(16);
    } else if (control.height > 0) {
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
  }
}

test("tasks survive reload and a browser restart, and backup restores them", async ({}, testInfo) => {
  const profile = await mkdtemp(join(tmpdir(), "reprise-webkit-"));
  const context = await webkit.launchPersistentContext(profile, {
    ...iphone,
    reducedMotion: "reduce",
    acceptDownloads: true,
    baseURL: "http://127.0.0.1:4173",
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await openApp(page);
    await addTask(page, "Market flowers");
    await addTask(page, "Call home");
    await page.reload();
    await page.getByRole("button", { name: "Inbox", exact: true }).click();
    await expect(page.getByText("Market flowers").first()).toBeVisible();
    await expect(page.getByText("Call home").first()).toBeVisible();
    await context.close();

    const restarted = await webkit.launchPersistentContext(profile, {
      ...iphone,
      reducedMotion: "reduce",
      acceptDownloads: true,
      baseURL: "http://127.0.0.1:4173",
    });
    try {
      const again = restarted.pages()[0] ?? (await restarted.newPage());
      await again.goto("/Reprise/");
      await again.getByRole("button", { name: "Inbox", exact: true }).click();
      await expect(again.getByText("Market flowers").first()).toBeVisible();
      await expect(again.getByText("Call home").first()).toBeVisible();

      await openBackup(again);
      await expect(again.getByText(/On this device:.*Market flowers/)).toBeVisible();
      await expect(again.getByText(/Call home/)).toBeVisible();
      for (const width of [320, 393, 430]) {
        await backupOverflow(again, width);
      }
      await again.setViewportSize(iphone.viewport);
      await again.screenshot({
        path: "/opt/cursor/artifacts/webkit_iphone_tasks_backup.png",
        fullPage: true,
      });
      const downloadPromise = again.waitForEvent("download");
      await again.getByRole("button", { name: "Export backup" }).click();
      const download = await downloadPromise;
      const backupPath = testInfo.outputPath("reprise-backup.json");
      await download.saveAs(backupPath);

      await again.getByRole("button", { name: "Home", exact: true }).click();
      await addTask(again, "Temporary note");
      await openBackup(again);
      await again.getByLabel("Import backup file").setInputFiles(backupPath);
      await again.getByRole("button", { name: "Replace tasks" }).click();
      await again.getByRole("button", { name: "Inbox", exact: true }).click();
      await expect(again.getByText("Market flowers").first()).toBeVisible();
      await expect(again.getByText("Call home").first()).toBeVisible();
      await expect(again.getByText("Temporary note")).toHaveCount(0);
    } finally {
      await restarted.close();
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
