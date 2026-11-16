import type { Env } from "./types";

export async function allowRate(env: Env, name: string, limit: number, nowMs: number): Promise<boolean> {
  const bucket = Math.floor(nowMs / 3_600_000);
  const key = `rate:${name}:${bucket}`;
  const raw = await env.PUSH_KV.get(key);
  const current = raw === null ? 0 : Number(raw);
  if (!Number.isInteger(current) || current < 0 || current >= limit) return false;
  await env.PUSH_KV.put(key, String(current + 1), { expirationTtl: 7_200 });
  return true;
}
