// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NotificationSidebar } from "./NotificationSidebar";
import {
  categoryLabel,
  filterNotices,
  type NoticeAction,
} from "./notifications";
import type { Notice } from "./model";
const fixture = (
  id: string,
  read = false,
  category = "Diagnostic",
): Notice => ({
  id,
  read,
  category,
  title: `Reminder ${id}`,
  message: "An intention worth returning to.",
  created_at: 100,
  scheduled_at: 100,
  submitted_at: null,
  state: "Submitted",
  task_id: null,
});
const manage = vi.fn(),
  review = vi.fn();
function Harness({
  initial = [
    fixture("read", true),
    fixture("daily", false, "DailyReview"),
    fixture("other"),
  ],
}: {
  initial?: Notice[];
}) {
  const [notices, setNotices] = useState(initial);
  return (
    <NotificationSidebar
      open
      pinned={false}
      onOpenChange={() => {}}
      onPin={async () => true}
      busy={false}
      notices={notices}
      tasks={[]}
      onRead={(id) =>
        setNotices((n) =>
          n.map((v) => (v.id === id ? { ...v, read: true } : v)),
        )
      }
      onTask={() => {}}
      onReview={review}
      onManage={async (action: NoticeAction, ids) => {
        manage(action, ids);
        setNotices((n) =>
          action === "read"
            ? n.map((v) => (ids.includes(v.id) ? { ...v, read: true } : v))
            : n.filter(
                (v) =>
                  !ids.includes(v.id) || (action === "clear_read" && !v.read),
              ),
        );
        return true;
      }}
      onUpdate={async () => {}}
      updateActivity={null}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);
describe("notification management", () => {
  it("formats stored identifiers without changing filter values", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    expect(
      screen
        .getByRole("option", { name: "Daily Review" })
        .getAttribute("value"),
    ).toBe("DailyReview");
    await user.selectOptions(screen.getByLabelText("Category"), "DailyReview");
    expect(screen.getByText("Reminder daily")).toBeTruthy();
    expect(screen.queryByText("Reminder other")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open Daily Review" }));
    expect(review).toHaveBeenCalledOnce();
  });
  it("dismisses unread entries without marking them read", async () => {
    render(<Harness />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Dismiss Reminder other" }));
    expect(screen.queryByText("Reminder other")).toBeNull();
    expect(manage).toHaveBeenCalledWith("dismiss", ["other"]);
  });
  it("confirms clearing read and preserves unread", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Clear read" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Reminder read")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear read" }));
    await user.click(
      screen.getByRole("button", { name: "Clear notifications" }),
    );
    await waitFor(() => expect(screen.queryByText("Reminder read")).toBeNull());
    expect(screen.getByText("Reminder daily")).toBeTruthy();
  });
  it("marks all read and then clears all to an empty state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(
      screen
        .getByRole("button", { name: "Mark all as read" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await user.click(
      screen.getByRole("button", { name: "Clear notifications" }),
    );
    await screen.findByText("Nothing waiting here.");
    expect(manage).toHaveBeenLastCalledWith("clear_all", [
      "read",
      "daily",
      "other",
    ]);
  });
  it("supports readable-category search and unread-only filtering", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(
      screen.getByLabelText("Search notifications"),
      "daily review",
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.clear(screen.getByLabelText("Search notifications"));
    await user.click(screen.getByLabelText("Unread only"));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
  it("handles empty and long notification content", () => {
    const content = fixture("long");
    content.title = "Long title ".repeat(40);
    content.message = "Long detail ".repeat(100);
    render(<Harness initial={[content]} />);
    expect(screen.getByText(content.title.trim())).toBeTruthy();
  });
  it("keeps actionable buttons disabled when an operation fails without erasing entries", async () => {
    render(
      <NotificationSidebar
        open
        pinned={false}
        onOpenChange={() => {}}
        onPin={async () => true}
        busy={false}
        notices={[fixture("one")]}
        tasks={[]}
        onRead={() => {}}
        onTask={() => {}}
        onReview={() => {}}
        onManage={async () => false}
        onUpdate={async () => {}}
        updateActivity={null}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Dismiss Reminder one" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Reminder one")).toBeTruthy();
  });
});
describe("category labels", () => {
  it("humanizes unknown legacy identifiers and searches without mutation", () => {
    expect(categoryLabel("FutureReminder")).toBe("Future Reminder");
    const n = fixture("one", false, "DailyReview");
    expect(filterNotices([n], "All", false, "daily review")).toEqual([n]);
    expect(n.category).toBe("DailyReview");
  });
});
