// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { TaskHistory, historyCategory } from "./TaskHistory";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => [{ at: 100, action: "Resurfaced", before: null, after: '{"status":"Settled","review_at":100}' }]) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("loads only when expanded and distinguishes review membership from lifecycle", async () => {
  render(<TaskHistory taskId="one" />);
  expect(invoke).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("Task history"));
  const entry = await screen.findByText("Resurfaced · Resurfaced");
  expect(entry.getAttribute("data-status")).toBe("Resurfaced");
  expect(invoke).toHaveBeenCalledWith("task_history", { id: "one" });
  expect(historyCategory({ at: 1, action: "Moved", before: null, after: '{"status":"DoNow"}' })).toBe("DoNow");
  expect(historyCategory({ at: 1, action: "Old", before: null, after: "bad legacy JSON" })).toBeUndefined();
});
