import { readFileSync, existsSync, readdirSync } from "node:fs";

const root = new URL("../../dist-web/", import.meta.url);
const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

function pngSize(path) {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 1, 4) !== "PNG") fail(`${path} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const indexPath = new URL("index.html", root);
const manifestPath = new URL("manifest.webmanifest", root);
const workerPath = new URL("sw.js", root);
for (const file of [indexPath, manifestPath, workerPath]) {
  if (!existsSync(file)) fail(`Missing ${file.pathname}`);
}
if (process.exitCode) process.exit(process.exitCode);

const index = readFileSync(indexPath, "utf8");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const worker = readFileSync(workerPath, "utf8");

const required = [
  ['rel="manifest"', index.includes('rel="manifest"')],
  ["apple-touch-icon", index.includes("apple-touch-icon")],
  [
    "apple-mobile-web-app-capable",
    index.includes('name="apple-mobile-web-app-capable" content="yes"'),
  ],
  ["apple-mobile-web-app-title", index.includes("apple-mobile-web-app-title")],
  ["viewport-fit=cover", index.includes("viewport-fit=cover")],
  ["theme-color", index.includes('name="theme-color"')],
  ["base /Reprise/", index.includes("/Reprise/")],
];
for (const [name, ok] of required) if (!ok) fail(`index.html missing ${name}`);

if (manifest.display !== "standalone") fail("manifest display must be standalone");
if (!manifest.name || !manifest.short_name) fail("manifest needs name and short_name");
if (manifest.start_url !== "/Reprise/" || manifest.scope !== "/Reprise/") {
  fail("manifest start_url and scope must be /Reprise/");
}
if (manifest.prefer_related_applications) {
  fail("prefer_related_applications blocks install");
}
const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
const declared = new Set(icons.map((icon) => icon.sizes));
if (!declared.has("256x256") || !declared.has("512x512")) {
  fail("manifest needs the existing 256 and 512 icons");
}
for (const icon of icons) {
  const file = new URL(icon.src, manifestPath);
  const size = pngSize(file);
  const [width, height] = icon.sizes.split("x").map(Number);
  if (size.width !== width || size.height !== height) {
    fail(`${icon.src} is ${size.width}x${size.height}, declared ${icon.sizes}`);
  }
}
const largest = Math.max(
  ...icons.map((icon) => Number(icon.sizes.split("x")[0])),
);
if (largest < 512) fail("installability wants a 512px icon");
const atLeast192 = icons.some((icon) => Number(icon.sizes.split("x")[0]) >= 192);
if (!atLeast192) fail("installability wants an icon at least 192px");

for (const name of ["push", "notificationclick", "fetch", "install", "activate"]) {
  if (!worker.includes(`addEventListener("${name}"`)) {
    fail(`service worker missing ${name} handler`);
  }
}
if (!worker.includes("caches.open") || !worker.includes("/Reprise/")) {
  fail("service worker must precache the /Reprise/ app shell");
}
if (!worker.includes("caches.delete") || !worker.includes("reprise-nightly-shell-")) {
  fail("service worker must delete old versioned shell caches");
}
if (!worker.includes("showNotification") || !worker.includes("reprise-notification-click")) {
  fail("service worker must keep push display and notification clicks");
}

const apple = new URL("icons/apple-touch-icon.png", root);
if (!existsSync(apple)) fail("missing apple-touch-icon.png");
else {
  const size = pngSize(apple);
  if (size.width < 180 || size.height < 180) {
    fail("apple-touch-icon is smaller than 180px");
  }
}

const cssFiles = readdirSync(new URL("assets/", root)).filter((name) =>
  name.endsWith(".css"),
);
const builtCss = cssFiles
  .map((name) => readFileSync(new URL(`assets/${name}`, root), "utf8"))
  .join("\n");
const compactCss = builtCss.replace(/\s+/g, "");
for (const needle of [
  "safe-area-inset-top",
  "safe-area-inset-right",
  "safe-area-inset-bottom",
  "safe-area-inset-left",
  "100dvh",
  "100vh",
  "font-size:16px",
  "phone-tabbar",
  "max-width:430px",
]) {
  const haystack = needle.includes(":") ? compactCss : builtCss;
  if (!haystack.includes(needle)) fail(`web CSS missing ${needle}`);
}
const desktopAssets = new URL("../../dist/assets/", import.meta.url);
if (existsSync(desktopAssets)) {
  const desktopCss = readdirSync(desktopAssets)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(new URL(name, desktopAssets), "utf8"))
    .join("\n");
  if (desktopCss.includes("safe-area-inset") || desktopCss.includes("phone-tabbar")) {
    fail("desktop CSS picked up the phone stylesheet");
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("PWA installability checks passed.");
const { spawnSync } = await import("node:child_process");
const phone = spawnSync(
  process.execPath,
  [new URL("./phone-layout.mjs", import.meta.url).pathname],
  { stdio: "inherit" },
);
if (phone.status !== 0) process.exit(phone.status ?? 1);
