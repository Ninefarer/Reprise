import { expect, test } from "@playwright/test";

test("the installed shell opens offline after the first visit", async ({ page, context }) => {
  await page.goto("/Reprise/");
  await expect(page.getByRole("heading", { name: "Set up your space." })).toBeVisible();
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/Reprise/");
    return registration?.active != null && navigator.serviceWorker.controller != null;
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Set up your space." })).toBeVisible();
});
