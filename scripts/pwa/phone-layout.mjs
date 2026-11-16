import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("../../dist-web/", import.meta.url);
const port = 4178;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  let path = decodeURIComponent(url.pathname);
  if (path === "/Reprise") path = "/Reprise/";
  if (!path.startsWith("/Reprise/")) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  let rel = path.slice("/Reprise/".length);
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  try {
    const body = await readFile(new URL(rel, root));
    res.writeHead(200, {
      "content-type": types[extname(rel)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end(`missing ${rel}`);
  }
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

const launchArgs = ["--no-sandbox", "--disable-dev-shm-usage"];
const browser = await chromium
  .launch({ channel: "chrome", args: launchArgs })
  .catch(() => chromium.launch({ args: launchArgs }));
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 1,
});
async function setWidth(width) {
  await page.setViewportSize({ width, height: 852 });
}
const failures = [];
async function measure(label) {
  const box = await page.evaluate(() => {
    const root = document.documentElement;
    let widest = { right: 0, label: "" };
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (rect.right > widest.right) {
        widest = {
          right: Math.round(rect.right),
          label: `${el.tagName}.${String(el.className).slice(0, 80)}`,
        };
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      widest,
    };
  });
  console.log(label, JSON.stringify(box));
  if (box.scrollWidth > box.clientWidth) {
    failures.push(
      `${label}: scrollWidth ${box.scrollWidth} > clientWidth ${box.clientWidth} (${box.widest.label} reaches ${box.widest.right})`,
    );
  }
}
async function fieldSizes() {
  return page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .filter((el) => {
        const type = el.getAttribute("type") ?? "";
        if (["checkbox", "radio", "range", "hidden", "file"].includes(type)) {
          return false;
        }
        const style = getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
      })
      .map((el) => ({
        name: el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.tagName,
        size: Number.parseFloat(getComputedStyle(el).fontSize),
      })),
  );
}

try {
  await page.goto(`http://127.0.0.1:${port}/Reprise/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Set up your space." }).waitFor();
  await measure("onboarding");
  const setupFields = await fieldSizes();
  console.log("onboarding fields", JSON.stringify(setupFields));
  for (const field of setupFields) {
    if (field.size < 16) failures.push(`onboarding ${field.name} is ${field.size}px`);
  }
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.getByRole("heading", { name: "You're running Reprise Nightly" }).waitFor();
  await measure("welcome dialog");
  const dialog = await page.locator("dialog[open]").boundingBox();
  if (!dialog || dialog.x < -1 || dialog.x + dialog.width > 394) {
    failures.push(`welcome dialog box ${JSON.stringify(dialog)}`);
  }
  await page.getByRole("button", { name: "Continue to Nightly" }).click();
  await page.getByRole("navigation", { name: "Sections" }).waitFor();
  await measure("main view");
  const mainFields = await fieldSizes();
  console.log("main fields", JSON.stringify(mainFields));
  if (!mainFields.length) failures.push("main view has no visible text fields");
  for (const field of mainFields) {
    if (field.size < 16) failures.push(`main ${field.name} is ${field.size}px`);
  }
  await setWidth(320);
  await measure("main view at 320");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await measure("more sheet at 320");
  await setWidth(430);
  await measure("main view at 430");
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Phone layout check passed at 320, 393, and 430px wide.");
