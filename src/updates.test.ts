import { describe, it, expect } from "vitest";
import { offeredVersion, updateMessage, friendlyUpdateError } from "./updates";
import type { Notice } from "./model";
const offer: Notice = {
  id: "update:available:3.2.0",
  category: "Updates",
  state: "UpdateAvailable",
  task_id: null,
  title: "Update",
  message: "Ready",
  created_at: 100,
  scheduled_at: 100,
  submitted_at: null,
  read: false,
};
describe("update notifications", () => {
  it("offers installation only for an actionable update notification", () => {
    expect(offeredVersion(offer)).toBe("3.2.0");
    expect(offeredVersion({ ...offer, read: true })).toBe("3.2.0");
    for (const state of [
      "UpdateCurrent",
      "UpdateSuperseded",
      "UpdateInstalled",
      "UpdateDownloading",
    ])
      expect(offeredVersion({ ...offer, state })).toBeNull();
    expect(offeredVersion({ ...offer, category: "Scheduled" })).toBeNull();
  });
  it("reports bounded progress and never invents a completed install", () => {
    expect(
      updateMessage({
        notice_id: offer.id,
        stage: "downloading",
        downloaded: 5,
        total: 10,
      }),
    ).toContain("50%");
    expect(
      updateMessage({
        notice_id: offer.id,
        stage: "downloading",
        downloaded: 20,
        total: 10,
      }),
    ).toContain("100%");
    expect(
      updateMessage({
        notice_id: offer.id,
        stage: "downloading",
        downloaded: 1,
        total: null,
      }),
    ).not.toContain("%");
    expect(
      updateMessage({
        notice_id: offer.id,
        stage: "installing",
        downloaded: 0,
        total: null,
      }),
    ).toContain("will restart");
  });
});

it("turns transport and installation internals into plain-language update feedback", () => {
  for (const detail of [
    "error sending request for url (https://example.invalid/latest.json): dns error",
    "network unreachable",
    "TLS connection failed",
    "request timed out",
  ]) {
    expect(friendlyUpdateError(detail)).toBe(
      "Couldn't reach the update service. Check your internet connection and try again.",
    );
    expect(friendlyUpdateError(detail)).not.toContain("https://");
  }
  expect(
    friendlyUpdateError("Signature verification failed", "install"),
  ).toContain("couldn't be verified");
  expect(friendlyUpdateError("internal updater panic code 42")).not.toContain(
    "42",
  );
});
