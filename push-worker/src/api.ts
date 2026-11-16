import { testPayload } from "./payload";
import { sendNotification, topicFor, ttlFor } from "./send";
import {
  appendPushLog,
  deleteReminders,
  deleteSubscription,
  forgetDevice,
  readPushLog,
  readReminders,
  readSubscription,
  writeReminders,
  writeSubscription,
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
    headers.set("access-control-allow-headers", "Content-Type, X-Reprise-Push-Secret, X-Device-Id");
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

function authorize(request: Request, env: Env, cors: Headers): Response | null {
  if (!env.PUSH_SHARED_SECRET) return json({ error: "push secret is not configured" }, 503, cors);
  const provided = request.headers.get("X-Reprise-Push-Secret") ?? "";
  if (!provided || provided.length > 256 || !secretsMatch(provided, env.PUSH_SHARED_SECRET)) {
    return json({ error: "unauthorized" }, 401, cors);
  }
  return null;
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

    const denied = authorize(request, env, cors);
    if (denied) return denied;

    if (request.method === "GET" && path === "/push-log") {
      return json({ entries: await readPushLog(env) }, 200, cors);
    }

    if (request.method === "DELETE" && path === "/subscribe") {
      const deviceId = deviceIdFrom(request);
      await deleteSubscription(env, deviceId);
      await deleteReminders(env, deviceId);
      await forgetDevice(env, deviceId);
      return json({ ok: true }, 200, cors);
    }

    if (request.method === "DELETE" && path.startsWith("/reminders/")) {
      const deviceId = deviceIdFrom(request);
      const id = decodeURIComponent(path.slice("/reminders/".length));
      const reminders = await readReminders(env, deviceId);
      await writeReminders(env, deviceId, reminders.filter((reminder) => reminder.id !== id));
      return json({ ok: true }, 200, cors);
    }

    const body = await readBody(request);
    if (request.method === "POST" && path === "/subscribe") {
      const deviceId = deviceIdFrom(request, body);
      const subscription = parseSubscription(body.subscription ?? body);
      await writeSubscription(env, deviceId, subscription);
      return json({ ok: true }, 200, cors);
    }

    if (request.method === "PUT" && path === "/reminders") {
      const deviceId = deviceIdFrom(request, body);
      const reminders = parseReminders(body.reminders, nowMs);
      await writeReminders(env, deviceId, reminders);
      return json({ ok: true, count: reminders.length }, 200, cors);
    }

    if (request.method === "POST" && path === "/test-push") {
      const deviceId = deviceIdFrom(request, body);
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
