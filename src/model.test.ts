import { describe, it, expect } from "vitest";
import {
  tasksForView,
  reviewGroups,
  remaining,
  matches,
  type Task,
} from "./model";
import { navigation, commandDestinations } from "./navigation";
const now = new Date(2026, 10, 10, 12).getTime() / 1000;
const task = (
  id: string,
  status: Task["status"],
  extra: Partial<Task> = {},
): Task => ({
  id,
  title: id,
  description: "",
  status,
  priority: 0,
  energy: "",
  created_at: now,
  updated_at: now,
  scheduled_at: null,
  due_at: null,
  wake_at: null,
  completed_at: null,
  project: "",
  tags: "",
  recurrence: "",
  reason: "",
  review_at: null,
  review_reason: null,
  parent_task_id: null,
  ...extra,
});
describe("navigation and review membership", () => {
  it("keeps returned tasks out of active paused pages without changing their lifecycle", () => {
    const tasks = [
      task("paused", "Settled", { wake_at: now + 500 }),
      task("returned", "Settled", { wake_at: now - 500, review_at: now }),
      task("sleeping", "Snoozed", { wake_at: now + 100 }),
      task("awake", "Snoozed", { review_at: now }),
    ];
    expect(tasksForView(tasks, "Settled", now).map((t) => t.id)).toEqual([
      "paused",
    ]);
    expect(tasksForView(tasks, "Snoozed", now).map((t) => t.id)).toEqual([
      "sleeping",
    ]);
    expect(tasksForView(tasks, "Resurfaced", now).map((t) => t.id)).toEqual([
      "returned",
      "awake",
    ]);
  });
  it("reviews waiting follow-ups, overdue and today while excluding closed tasks", () => {
    const tasks = [
      task("followup", "Waiting", { wake_at: now - 1 }),
      task("future", "Waiting", { wake_at: now + 500 }),
      task("due", "DoNow", { due_at: now - 1 }),
      task("today", "Scheduled", { scheduled_at: now + 100 }),
      task("done", "Finished", { due_at: now - 1, scheduled_at: now }),
    ];
    expect(tasksForView(tasks, "Daily Review", now).map((t) => t.id)).toEqual([
      "followup",
      "due",
      "today",
    ]);
    expect(
      reviewGroups(tasks, now)
        .find((g) => g.title === "Waiting follow-ups")
        ?.tasks.map((t) => t.id),
    ).toEqual(["followup"]);
  });
  it("counts overlapping daily review membership only once", () => {
    const t = task("overlap", "Inbox", {
      review_at: now,
      due_at: now - 1,
      scheduled_at: now,
    });
    expect(tasksForView([t], "Daily Review", now)).toHaveLength(1);
  });
  it("exposes all lifecycle views and daily review through navigation", () => {
    const destinations = navigation.flatMap((g) => g.items);
    for (const view of [
      "Home",
      "Daily Review",
      "Settled",
      "Snoozed",
      "Resurfaced",
    ])
      expect(destinations).toContain(view);
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations).not.toContain("Settings");
    expect(destinations).not.toContain("Notification History");
    expect(commandDestinations).toContain("Settings");
    expect(commandDestinations).toContain("Notification History");
  });
  it("searches notes, project and tags", () => {
    expect(
      matches(
        task("title", "Inbox", {
          project: "Studio",
          tags: "creative",
          description: "a thought",
        }),
        "studio",
      ),
    ).toBe(true);
    expect(matches(task("title", "Inbox"), "missing")).toBe(false);
  });
  it("shows due timers accurately", () => {
    expect(remaining(now + 900, now)).toBe("Returns in 15 min");
    expect(remaining(now - 1, now)).toContain("awaiting scheduler");
  });
});
