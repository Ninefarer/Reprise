import { testPayload } from "./payload";
import { allowRate } from "./ratelimit";
import { sendNotification, topicFor, ttlFor } from "./send";
import {
  appendPushLog,
  createDeviceToken,
  deleteReminders,
  deleteSubscription,
  deleteToken,
  deviceTokenMatches,
  forgetDevice,
  listDevices,
  readPushLog,
  readReminders,
  readSubscription,
  readTokenHash,
  writeReminders,
  writeSubscription,
  writeTokenHash,
} from "./store";
import type { Env, PushLogEntry } from "./types";
import { LIMITS } from "./types";
import { notificationUrl, normalizeTitle, parseReminders, parseSubscription, PushInputError, requireDeviceId } from "./validate";

export interface RequestDeps {
  fetchImpl?: typeof fetch;
  now?: number;
}

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.origin !== trimmed) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function corsHeaders(request: Request, allowedOrigin: string): Headers {
  const headers = new Headers();
  headers.set("vary", "Origin");
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set(
      "access-control-allow-headers",
      "Content-Type, X-Reprise-Push-Secret, X-Reprise-Device-Token, X-Device-Id",
    );
    headers.set("access-control-max-age", "86400");
  }
  return headers;
}

function json(body: unknown, status: number, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function secretsMatch(provided: string, expected: string): boolean {
  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}

function deviceIdFrom(request: Request, body?: Record<string, unknown>): string {
  const header = request.headers.get("X-Device-Id");
  const query = new URL(request.url).searchParams.get("deviceId");
  const fromBody = body?.deviceId;
  return requireDeviceId(header || query || fromBody);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > LIMITS.maxBodyBytes) throw new PushInputError("request body is too large");
  const text = await request.text();
  if (text.length > LIMITS.maxBodyBytes) throw new PushInputError("request body is too large");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PushInputError("JSON object required");
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof PushInputError) throw error;
    throw new PushInputError("request body must be JSON");
  }
}

function authorizeShared(request: Request, env: Env, cors: Headers): Response | null {
  if (!env.PUSH_SHARED_SECRET) return json({ error: "push secret is not configured" }, 503, cors);
  const provided = request.headers.get("X-Reprise-Push-Secret") ?? "";
  if (!provided || provided.length > 256 || !secretsMatch(provided, env.PUSH_SHARED_SECRET)) {
    return json({ error: "unauthorized" }, 401, cors);
  }
  return null;
}

function authorizeAdmin(request: Request, env: Env, cors: Headers): Response | null {
  if (!env.PUSH_ADMIN_SECRET) return json({ error: "admin secret is not configured" }, 503, cors);
  const provided = request.headers.get("X-Reprise-Admin-Secret") ?? "";
  if (!provided || provided.length > 256 || !secretsMatch(provided, env.PUSH_ADMIN_SECRET)) {
    return json({ error: "unauthorized" }, 401, cors);
  }
  return null;
}

async function requireDeviceToken(request: Request, env: Env, deviceId: string, cors: Headers): Promise<Response | null> {
  const token = request.headers.get("X-Reprise-Device-Token") ?? "";
  if (!(await deviceTokenMatches(env, deviceId, token))) {
    return json({ error: "device token required" }, 401, cors);
  }
  return null;
}

function tooMany(cors: Headers): Response {
  return json({ error: "too many requests" }, 429, cors);
}

function logEntry(input: {
  nowMs: number;
  deviceId: string;
  endpointHost: string;
  status: number;
  reason: string;
  apnsId: string | null;
  reminderId: string | null;
  kind: PushLogEntry["kind"];
}): PushLogEntry {
  return {
    at: new Date(input.nowMs).toISOString(),
    deviceId: input.deviceId,
    endpointHost: input.endpointHost,
    status: input.status,
    reason: input.reason,
    apnsId: input.apnsId,
    reminderId: input.reminderId,
    kind: input.kind,
  };
}

export async function handleRequest(request: Request, env: Env, deps: RequestDeps = {}): Promise<Response> {
  const allowedOrigin = normalizeOrigin(env.ALLOWED_ORIGIN ?? "");
  const origin = request.headers.get("Origin");
  if (origin && origin !== allowedOrigin) {
    return json({ error: "origin is not allowed" }, 403, new Headers({ vary: "Origin" }));
  }
  const cors = corsHeaders(request, allowedOrigin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const nowMs = deps.now ?? Date.now();

  try {
    if (request.method === "GET" && path === "/vapid-public-key") {
      if (!env.VAPID_PUBLIC_KEY) return json({ error: "VAPID public key is not configured" }, 500, cors);
      return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, cors);
    }

    const protectedRoute =
      (request.method === "POST" && (path === "/subscribe" || path === "/test-push")) ||
      (request.method === "PUT" && path === "/reminders") ||
      (request.method === "DELETE" && (path === "/subscribe" || path.startsWith("/reminders/"))) ||
      (request.method === "GET" && path === "/push-log");
    if (!protectedRoute) return json({ error: "not found" }, 404, cors);

    if (request.method === "GET" && path === "/push-log") {
      const denied = authorizeAdmin(request, env, cors);
      if (denied) return denied;
      return json({ entries: await readPushLog(env) }, 200, cors);
    }

    const denied = authorizeShared(request, env, cors);
    if (denied) return denied;

    if (request.method === "DELETE" && path === "/subscribe") {
      const deviceId = deviceIdFrom(request);
      const tokenDenied = await requireDeviceToken(request, env, deviceId, cors);
      if (tokenDenied) return tokenDenied;
      await deleteSubscription(env, deviceId);
      await deleteReminders(env, deviceId);
      await deleteToken(env, deviceId);
      await forgetDevice(env, deviceId);
      return json({ ok: true }, 200, cors);
    }

    if (request.method === "DELETE" && path.startsWith("/reminders/")) {
      const deviceId = deviceIdFrom(request);
      const tokenDenied = await requireDeviceToken(request, env, deviceId, cors);
      if (tokenDenied) return tokenDenied;
      if (!(await allowRate(env, `reminders:${deviceId}`, LIMITS.reminderWritesPerDevicePerHour, nowMs))) return tooMany(cors);
      const id = decodeURIComponent(path.slice("/reminders/".length));
      const reminders = await readReminders(env, deviceId);
      await writeReminders(env, deviceId, reminders.filter((reminder) => reminder.id !== id));
      return json({ ok: true }, 200, cors);
    }

    const body = await readBody(request);
    if (request.method === "POST" && path === "/subscribe") {
      const deviceId = deviceIdFrom(request, body);
      const subscription = parseSubscription(body.subscription ?? body);
      const existing = await readTokenHash(env, deviceId);
      if (existing) {
        const tokenDenied = await requireDeviceToken(request, env, deviceId, cors);
        if (tokenDenied) return tokenDenied;
      } else {
        const devices = await listDevices(env);
        if (!devices.includes(deviceId) && devices.length >= LIMITS.maxDevices) {
          return json({ error: "device limit reached" }, 429, cors);
        }
        if (!(await allowRate(env, "subscribe", LIMITS.subscribePerHour, nowMs))) return tooMany(cors);
      }
      await writeSubscription(env, deviceId, subscription);
      if (existing) return json({ ok: true }, 200, cors);
      const deviceToken = createDeviceToken();
      await writeTokenHash(env, deviceId, deviceToken);
      return json({ ok: true, deviceToken }, 200, cors);
    }

    if (request.method === "PUT" && path === "/reminders") {
      const deviceId = deviceIdFrom(request, body);
      const tokenDenied = await requireDeviceToken(request, env, deviceId, cors);
      if (tokenDenied) return tokenDenied;
      if (!(await allowRate(env, `reminders:${deviceId}`, LIMITS.reminderWritesPerDevicePerHour, nowMs))) return tooMany(cors);
      const reminders = parseReminders(body.reminders, nowMs);
      await writeReminders(env, deviceId, reminders);
      return json({ ok: true, count: reminders.length }, 200, cors);
    }

    if (request.method === "POST" && path === "/test-push") {
      const deviceId = deviceIdFrom(request, body);
      const tokenDenied = await requireDeviceToken(request, env, deviceId, cors);
      if (tokenDenied) return tokenDenied;
      if (!(await allowRate(env, `test:${deviceId}`, LIMITS.testPushPerDevicePerHour, nowMs))) return tooMany(cors);
      if (!(await allowRate(env, "test:all", LIMITS.testPushGlobalPerHour, nowMs))) return tooMany(cors);
      const subscription = await readSubscription(env, deviceId);
      if (!subscription) return json({ error: "no subscription" }, 404, cors);
      const payload = testPayload({
        title: body.title === undefined ? "Reprise" : normalizeTitle(body.title),
        body: body.body === undefined ? "Test notification" : normalizeTitle(body.body),
        url: notificationUrl(body.url, allowedOrigin),
      });
      const result = await sendNotification({
        env,
        subscription,
        payload,
        topic: await topicFor("test", payload.tag),
        ttl: ttlFor("test"),
        nowMs,
        fetchImpl: deps.fetchImpl,
      });
      await appendPushLog(env, [
        logEntry({
          nowMs,
          deviceId,
          endpointHost: result.endpointHost,
          status: result.status,
          reason: result.reason,
          apnsId: result.apnsId,
          reminderId: null,
          kind: "test",
        }),
      ]);
      if (result.stale) {
        await deleteSubscription(env, deviceId);
        return json({ error: "subscription expired", status: result.status, reason: result.reason, endpointHost: result.endpointHost }, 410, cors);
      }
      if (!result.ok) {
        return json({ error: "push was rejected", status: result.status, reason: result.reason, endpointHost: result.endpointHost }, 502, cors);
      }
      return json({ ok: true, status: result.status, endpointHost: result.endpointHost }, 200, cors);
    }
  } catch (error) {
    if (error instanceof PushInputError) return json({ error: error.message }, 400, cors);
    const message = error instanceof Error ? error.message : "push failed";
    return json({ error: message }, 500, cors);
  }

  return json({ error: "not found" }, 404, cors);
}
