// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { TaskHistory, historyCategory } from "./TaskHistory";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => [
    {
      at: 100,
      action: "Resurfaced",
      before: null,
      after: '{"status":"Settled","review_at":100}',
    },
  ]),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("loads only when expanded and distinguishes review membership from lifecycle", async () => {
  render(<TaskHistory taskId="one" />);
  expect(invoke).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("Task history"));
  const entry = await screen.findByText("Resurfaced by Reprise");
  expect(screen.getByText("Returned on schedule.")).toBeTruthy();
  expect(entry.getAttribute("data-status")).toBe("Resurfaced");
  expect(invoke).toHaveBeenCalledWith("task_history", { id: "one" });
  expect(
    historyCategory({
      at: 1,
      action: "Moved",
      before: null,
      after: '{"status":"DoNow"}',
    }),
  ).toBe("DoNow");
  expect(
    historyCategory({
      at: 1,
      action: "Old",
      before: null,
      after: "bad legacy JSON",
    }),
  ).toBeUndefined();
});

it("shows the first event at the top, including events with matching timestamps", async () => {
  vi.mocked(invoke).mockResolvedValueOnce([
    {
      at: 100,
      action: "AutoSettled",
      before: '{"status":"Inbox"}',
      after: '{"status":"Settled","_auto_settle_days":5}',
    },
    {
      at: 100,
      action: "Edited",
      before: '{"status":"Inbox","description":""}',
      after: '{"status":"Inbox","description":"New note"}',
    },
  ]);

  render(<TaskHistory taskId="timeline" standalone />);
  expect(await screen.findByText("Auto-settled by Reprise")).toBeTruthy();
  expect(screen.queryByText("Task history")).toBeNull();
  const entries = screen.getAllByRole("listitem");
  expect(entries[0].textContent).toContain("Changed description.");
  expect(entries[1].textContent).toContain(
    "Moved from Inbox after 5 days without a next step.",
  );
});
