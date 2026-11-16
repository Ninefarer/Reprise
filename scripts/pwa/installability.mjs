import { readFileSync, existsSync } from "node:fs";

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

for (const name of ["push", "notificationclick", "fetch"]) {
  if (!worker.includes(`addEventListener("${name}"`)) {
    fail(`service worker missing ${name} handler`);
  }
}
if (worker.includes("caches.open") || worker.includes("cache.add")) {
  fail("service worker must not add a cache strategy in this branch");
}

const apple = new URL("icons/apple-touch-icon.png", root);
if (!existsSync(apple)) fail("missing apple-touch-icon.png");
else {
  const size = pngSize(apple);
  if (size.width < 180 || size.height < 180) {
    fail("apple-touch-icon is smaller than 180px");
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("PWA installability checks passed.");
