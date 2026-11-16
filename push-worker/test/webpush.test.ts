import { describe, expect, it } from "vitest";
import { base64url, base64urlDecode, utf8Decode } from "../src/bytes";
import { decryptWebPush, deriveAes128Gcm, encryptWebPush } from "../src/webpush";

const rfc = {
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  ecdh: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
  prkKey: "Snr3JMxaHVDXHWJn5wdC52WjpCtd2EIEGBykDcZW32k",
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  prk: "09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("RFC 8291 aes128gcm", () => {
  it("derives the appendix A key schedule and ciphertext", async () => {
    const derived = await deriveAes128Gcm({
      uaPublic: base64urlDecode(rfc.uaPublic),
      asPublic: base64urlDecode(rfc.asPublic),
      asPrivate: base64urlDecode(rfc.asPrivate),
      auth: base64urlDecode(rfc.auth),
      salt: base64urlDecode(rfc.salt),
    });
    expect(base64url(derived.ecdhSecret)).toBe(rfc.ecdh);
    expect(base64url(derived.prkKey)).toBe(rfc.prkKey);
    expect(base64url(derived.ikm)).toBe(rfc.ikm);
    expect(base64url(derived.prk)).toBe(rfc.prk);
    expect(base64url(derived.cek)).toBe(rfc.cek);
    expect(base64url(derived.nonce)).toBe(rfc.nonce);

    const plaintext = new TextEncoder().encode("When I grow up, I want to be a watermelon");
    const body = await encryptWebPush(
      plaintext,
      { p256dh: base64urlDecode(rfc.uaPublic), auth: base64urlDecode(rfc.auth) },
      {
        privateKey: base64urlDecode(rfc.asPrivate),
        publicKey: base64urlDecode(rfc.asPublic),
        salt: base64urlDecode(rfc.salt),
      },
    );
    // The example body is 144 bytes. The RFC's printed Content-Length of 145 does not match it.
    expect(body.length).toBe(144);
    expect(base64url(body)).toBe(rfc.body);
  });

  it("round-trips a notification payload", async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const privateKey = base64urlDecode(jwk.d ?? "");
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const payload = new TextEncoder().encode(JSON.stringify({
      title: "Call Alex",
      body: "Reminder",
      tag: "call-alex",
      url: "/?reminder=call-alex",
    }));
    const body = await encryptWebPush(payload, { p256dh: publicKey, auth });
    const decoded = await decryptWebPush(body, { privateKey, publicKey, auth });
    expect(utf8Decode(decoded)).toBe(utf8Decode(payload));
  });
});
