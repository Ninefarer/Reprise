import { describe, it, expect } from "vitest";
import { taskActions } from "./taskActions";
import type { Task, Status } from "./model";
const task = (status: Status, review = false) =>
  ({ status, review_at: review ? 100 : null }) as Task;
describe("context actions", () => {
  it.each<Status>([
    "Inbox",
    "DoNow",
    "Scheduled",
    "Settled",
    "Snoozed",
    "Waiting",
    "Finished",
    "Dropped",
  ])("gives %s a unique relevant menu", (status) => {
    const actions = taskActions(task(status));
    expect(new Set(actions.map((a) => a.id)).size).toBe(actions.length);
    expect(actions.some((a) => a.id === "delete")).toBe(true);
    if (status === "DoNow")
      expect(actions.some((a) => a.id === "start")).toBe(false);
    if (status === "Finished" || status === "Dropped")
      expect(actions.map((a) => a.id)).toEqual(["inbox", "history", "delete"]);
  });
  it("distinguishes resume, start, wake and resurface", () => {
    expect(taskActions(task("Settled")).map((a) => a.id)).toEqual(
      expect.arrayContaining(["resume", "start", "surface", "return"]),
    );
    expect(
      taskActions(task("Snoozed")).find((a) => a.id === "surface")?.label,
    ).toBe("Wake Now");
    expect(taskActions(task("Waiting")).some((a) => a.id === "surface")).toBe(
      false,
    );
  });
  it("gives resurfaced tasks a review menu rather than another wake", () => {
    const actions = taskActions(task("Settled", true));
    expect(actions[0].id).toBe("review");
    expect(actions.some((a) => a.id === "surface")).toBe(false);
    expect(actions.some((a) => a.id === "drop")).toBe(true);
  });
});
