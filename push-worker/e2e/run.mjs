import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = join(root, "e2e", "fixture");
const devVarsPath = join(root, ".dev.vars");
const persistDir = `/tmp/reprise-push-e2e-${process.pid}`;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const open = await new Promise((resolve) => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (open) return;
    await sleep(200);
  }
  throw new Error(`worker did not listen on ${port}`);
}

function startFixture(port) {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const file = path === "/" ? "index.html" : path.slice(1);
    try {
      const body = await readFile(join(fixtureDir, file));
      response.writeHead(200, {
        "content-type": types[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function workerJson(port, path, init = {}) {
  const headers = new Headers(init.headers);
  if (init.secret) headers.set("x-reprise-push-secret", init.secret);
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, text };
}

const report = {
  vapidPublicKeyServed: false,
  subscriptionHost: null,
  testPush: null,
  earlyCronSentReminder: null,
  scheduledReminder: null,
  notificationErrors: [],
  logHosts: [],
};

let workerProcess;
let fixture;
let browser;

try {
  const keys = JSON.parse(
    (await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/generate-vapid-keys.mjs", "--json"], { cwd: root });
      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => {
        out += chunk;
      });
      child.stderr.on("data", (chunk) => {
        err += chunk;
      });
      child.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `keygen exited ${code}`))));
    })),
  );
  const secret = crypto.randomUUID();
  const fixturePort = await freePort();
  const workerPort = await freePort();
  const inspectorPort = await freePort();
  const origin = `http://127.0.0.1:${fixturePort}`;
  await writeFile(
    devVarsPath,
    [
      `ALLOWED_ORIGIN=${origin}`,
      "VAPID_SUBJECT=mailto:push@example.com",
      `VAPID_PUBLIC_KEY=${keys.publicKey}`,
      `VAPID_PRIVATE_KEY=${keys.privateKey}`,
      `PUSH_SHARED_SECRET=${secret}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  fixture = await startFixture(fixturePort);
  workerProcess = spawn(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "dev",
      "--port",
      String(workerPort),
      "--ip",
      "127.0.0.1",
      "--inspector-port",
      String(inspectorPort),
      "--test-scheduled",
      "--persist-to",
      persistDir,
      "--show-interactive-dev-session=false",
      "--log-level",
      "info",
    ],
    {
      cwd: root,
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let workerLog = "";
  const collect = (chunk) => {
    workerLog += chunk.toString();
    if (workerLog.length > 80_000) workerLog = workerLog.slice(-40_000);
  };
  workerProcess.stdout.on("data", collect);
  workerProcess.stderr.on("data", collect);
  await waitForPort(workerPort, 60_000);
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const health = await workerJson(workerPort, "/vapid-public-key");
      if (health.status === 200 && health.body?.publicKey === keys.publicKey) {
        ready = true;
        break;
      }
    } catch {
      // Wrangler is listening before the worker is ready.
    }
    await sleep(250);
  }
  if (!ready) throw new Error(`worker did not serve the VAPID key\n${workerLog.slice(-4000)}`);
  report.vapidPublicKeyServed = true;

  browser = await chromium.launch({
    // Headless Chrome grants notification permission and still refuses push
    // registration. A real window, including one on Xvfb, can register.
    headless: !process.env.DISPLAY,
    channel: "chrome",
    args: ["--enable-features=PushMessaging"],
  });
  const context = await browser.newContext({ permissions: ["notifications"] });
  await context.grantPermissions(["notifications"], { origin });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  report.browser = await browser.version();
  const subscription = await page.evaluate(async (publicKey) => {
    const permission = await Notification.requestPermission();
    const queried = await navigator.permissions.query({ name: "notifications" });
    if (permission !== "granted") {
      throw new Error(`notification permission is ${permission} (${queried.state})`);
    }
    await window.__ready;
    const registration = await navigator.serviceWorker.ready;
    const pad = (4 - (publicKey.length % 4)) % 4;
    const padded = publicKey.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    try {
      const created = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      return created.toJSON();
    } catch (error) {
      throw new Error(`${error} (permission ${Notification.permission}/${queried.state}, ${navigator.userAgent})`);
    }
  }, keys.publicKey);
  report.subscriptionHost = new URL(subscription.endpoint).host;

  const subscribed = await workerJson(workerPort, "/subscribe", {
    method: "POST",
    secret,
    body: JSON.stringify({ deviceId: "e2e-phone", subscription }),
  });
  if (subscribed.status !== 200) throw new Error(`subscribe failed: ${subscribed.status} ${subscribed.text}`);

  const tested = await workerJson(workerPort, "/test-push", {
    method: "POST",
    secret,
    body: JSON.stringify({ deviceId: "e2e-phone", title: "Reprise", body: "Test notification", url: "/" }),
  });
  report.testPush = { http: tested.status, body: tested.body };
  if (tested.status !== 200) throw new Error(`test push failed: ${tested.status} ${tested.text}`);
  await page.waitForFunction(() => window.__pushes.length >= 1, null, { timeout: 30_000 });

  const minuteAt = Math.floor(Date.now() / 1000) + 60;
  const laterAt = minuteAt + 600;
  const saved = await workerJson(workerPort, "/reminders", {
    method: "PUT",
    secret,
    body: JSON.stringify({
      deviceId: "e2e-phone",
      reminders: [
        { id: "in-one-minute", at: minuteAt, category: "Deadline" },
        { id: "later", at: laterAt, category: "Scheduled" },
      ],
    }),
  });
  if (saved.status !== 200) throw new Error(`reminders failed: ${saved.status} ${saved.text}`);
  const early = await workerJson(workerPort, "/__scheduled?cron=*+*+*+*+*");
  if (early.status !== 200) throw new Error(`early cron failed: ${early.status} ${early.text}`);
  await sleep(1_000);
  const afterEarly = await page.evaluate(() => window.__pushes.map((entry) => entry.payload.tag));
  report.earlyCronSentReminder = afterEarly.includes("in-one-minute");
  if (report.earlyCronSentReminder) throw new Error("cron sent a reminder before it was due");

  const remaining = minuteAt * 1000 - Date.now() + 1_500;
  if (remaining > 0) await sleep(remaining);
  const due = await workerJson(workerPort, "/__scheduled?cron=*+*+*+*+*");
  if (due.status !== 200) throw new Error(`due cron failed: ${due.status} ${due.text}`);
  await page.waitForFunction(() => window.__pushes.some((entry) => entry.payload.tag === "in-one-minute"), null, {
    timeout: 30_000,
  });
  const pushes = await page.evaluate(() => window.__pushes);
  report.notificationErrors = pushes.map((entry) => entry.notificationError).filter(Boolean);
  const reminder = pushes.find((entry) => entry.payload.tag === "in-one-minute");
  report.scheduledReminder = reminder?.payload ?? null;
  if (
    reminder?.payload.title !== "Reprise" ||
    reminder?.payload.body !== "Deadline reminder" ||
    reminder?.payload.url !== "./" ||
    reminder?.payload.taskId ||
    reminder?.payload.review
  ) {
    throw new Error(`unexpected reminder payload ${JSON.stringify(reminder?.payload)}`);
  }
  if (pushes.some((entry) => entry.payload.tag === "later")) throw new Error("a future reminder was delivered");

  const log = await workerJson(workerPort, "/push-log", { secret });
  const entries = log.body?.entries ?? [];
  report.logHosts = [...new Set(entries.map((entry) => entry.endpointHost))];
  const loggedReminder = entries.find((entry) => entry.reminderId === "in-one-minute");
  const loggedLater = entries.find((entry) => entry.reminderId === "later");
  if (!loggedReminder || loggedReminder.status < 200 || loggedReminder.status >= 300) {
    throw new Error(`reminder log was ${JSON.stringify(loggedReminder)}`);
  }
  if (loggedLater) throw new Error("future reminder was logged as sent");
  if (JSON.stringify(entries).includes(new URL(subscription.endpoint).pathname)) {
    throw new Error("push log included the endpoint path");
  }
  if (pageErrors.length) throw new Error(pageErrors.join("\n"));
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (fixture) await new Promise((resolve) => fixture.close(resolve));
  if (workerProcess) {
    workerProcess.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => workerProcess.once("exit", resolve)),
      sleep(5_000).then(() => workerProcess.kill("SIGKILL")),
    ]);
  }
  await rm(devVarsPath, { force: true });
  await rm(persistDir, { recursive: true, force: true });
}
