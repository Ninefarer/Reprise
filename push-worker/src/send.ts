import { asBuffer, base64urlDecode } from "./bytes";
import { encodePayload } from "./payload";
import type { Env, NotificationPayload, SendResult, SubscriptionRecord } from "./types";
import { LIMITS } from "./types";
import { createVapidAuthorization, topicForReminder } from "./vapid";
import { encryptWebPush } from "./webpush";

export async function sendNotification(input: {
  env: Env;
  subscription: SubscriptionRecord;
  payload: NotificationPayload;
  topic: string;
  ttl: number;
  nowMs: number;
  fetchImpl?: typeof fetch;
}): Promise<SendResult> {
  const endpoint = new URL(input.subscription.endpoint);
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    const vapid = await createVapidAuthorization({
      endpoint: input.subscription.endpoint,
      subject: input.env.VAPID_SUBJECT,
      publicKey: input.env.VAPID_PUBLIC_KEY,
      privateKey: input.env.VAPID_PRIVATE_KEY,
      nowMs: input.nowMs,
    });
    const plaintext = encodePayload(input.payload);
    if (plaintext.byteLength > LIMITS.maxPayloadBytes) {
      return {
        ok: false,
        stale: false,
        status: 0,
        reason: "notification payload is too large",
        endpointHost: endpoint.host,
        apnsId: null,
      };
    }
    const body = await encryptWebPush(plaintext, {
      p256dh: base64urlDecode(input.subscription.p256dh),
      auth: base64urlDecode(input.subscription.auth),
    });
    response = await fetchImpl(input.subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapid.authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(input.ttl),
        Urgency: "high",
        Topic: input.topic,
      },
      body: asBuffer(body),
    });
  } catch (error) {
    return {
      ok: false,
      stale: false,
      status: 0,
      reason: error instanceof Error ? error.message : "push request failed",
      endpointHost: endpoint.host,
      apnsId: null,
    };
  }
  const reason = (await response.text()).slice(0, 500);
  const status = response.status;
  return {
    ok: status >= 200 && status < 300,
    stale: status === 404 || status === 410,
    status,
    reason,
    endpointHost: endpoint.host,
    apnsId: response.headers.get("apns-id"),
  };
}

export async function topicFor(kind: "reminder" | "test", id: string): Promise<string> {
  if (kind === "test") return "reprise-test";
  return topicForReminder(id);
}

export function ttlFor(kind: "reminder" | "test"): number {
  return kind === "test" ? LIMITS.testTtlSeconds : LIMITS.reminderTtlSeconds;
}
