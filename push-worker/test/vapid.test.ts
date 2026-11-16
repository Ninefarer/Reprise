import { beforeEach, describe, expect, it } from "vitest";
import { asBuffer, base64url, base64urlDecode, utf8Decode } from "../src/bytes";
import {
  clearVapidCache,
  createVapidAuthorization,
  importVerifyKey,
  pushServiceOrigin,
  signVapidJwt,
  validVapidSubject,
  vapidSigningInput,
} from "../src/vapid";
import { generateVapidKeys } from "./helpers";

const RFC_UNSIGNED =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL3B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1haWx0bzpwdXNoQGV4YW1wbGUuY29tIn0";

describe("RFC 8292 VAPID", () => {
  beforeEach(() => clearVapidCache());

  it("encodes the example JWT claims and uncompressed public key", () => {
    expect(vapidSigningInput("https://push.example.net", "mailto:push@example.com", 1453523768)).toBe(RFC_UNSIGNED);
    const x = base64urlDecode("DUfHPKLVFQzVvnCPGyfucbECzPDa7rWbXriLcysAjEc");
    const y = base64urlDecode("F6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs");
    const point = new Uint8Array(65);
    point[0] = 4;
    point.set(x, 1);
    point.set(y, 33);
    expect(base64url(point)).toBe("BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs");
  });

  it("signs a token the public key can verify, and rejects a flipped signature", async () => {
    const keys = await generateVapidKeys();
    const token = await signVapidJwt({
      privateKey: base64urlDecode(keys.privateKey),
      publicKey: base64urlDecode(keys.publicKey),
      audience: "https://web.push.apple.com",
      subject: "mailto:push@example.com",
      expiresAt: 1_700_000_000,
    });
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(utf8Decode(base64urlDecode(header)))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(utf8Decode(base64urlDecode(payload)))).toEqual({
      aud: "https://web.push.apple.com",
      exp: 1_700_000_000,
      sub: "mailto:push@example.com",
    });
    const key = await importVerifyKey(base64urlDecode(keys.publicKey));
    const signed = new TextEncoder().encode(`${header}.${payload}`);
    const signatureBytes = base64urlDecode(signature);
    expect(signatureBytes.length).toBe(64);
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, asBuffer(signatureBytes), asBuffer(signed))).toBe(true);
    signatureBytes[0] ^= 0xff;
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, asBuffer(signatureBytes), asBuffer(signed))).toBe(false);
  });

  it("sets aud to the push service origin and reuses the token for an hour", async () => {
    const keys = await generateVapidKeys();
    const first = await createVapidAuthorization({
      endpoint: "https://web.push.apple.com/Qabc/secret",
      subject: "mailto:push@example.com",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      nowMs: Date.parse("2026-11-16T18:00:00.000Z"),
    });
    expect(pushServiceOrigin("https://web.push.apple.com/Qabc/secret")).toBe("https://web.push.apple.com");
    expect(first.origin).toBe("https://web.push.apple.com");
    expect(first.authorization.startsWith("vapid t=")).toBe(true);
    expect(first.authorization.endsWith(`, k=${keys.publicKey}`)).toBe(true);
    const token = first.authorization.slice("vapid t=".length, first.authorization.indexOf(", k="));
    const claims = JSON.parse(utf8Decode(base64urlDecode(token.split(".")[1])));
    expect(claims.aud).toBe("https://web.push.apple.com");
    expect(claims.exp).toBe(Math.floor(Date.parse("2026-11-16T18:00:00.000Z") / 1000) + 12 * 60 * 60);

    const second = await createVapidAuthorization({
      endpoint: "https://web.push.apple.com/other",
      subject: "mailto:push@example.com",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      nowMs: Date.parse("2026-11-16T18:30:00.000Z"),
    });
    expect(second.authorization).toBe(first.authorization);

    const later = await createVapidAuthorization({
      endpoint: "https://web.push.apple.com/other",
      subject: "mailto:push@example.com",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      nowMs: Date.parse("2026-11-16T19:30:00.000Z"),
    });
    expect(later.authorization).not.toBe(first.authorization);
  });

  it("rejects subjects Apple treats as invalid", () => {
    expect(validVapidSubject("mailto:push@example.com")).toBe(true);
    expect(validVapidSubject("https://example.com/push")).toBe(true);
    expect(validVapidSubject("mailto:push@localhost")).toBe(false);
    expect(validVapidSubject("mailto: push@example.com")).toBe(false);
    expect(validVapidSubject("http://example.com")).toBe(false);
  });
});
