// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { NOTICE_MOTION_MS, SlideSlot, useNoticePresence } from "./SlideSlot";
function List({
  items,
  scope = "all",
}: {
  items: { id: string; title: string }[];
  scope?: string;
}) {
  const entries = useNoticePresence(items, scope);
  return (
    <>
      {entries.map(({ key, item, leaving }) => (
        <SlideSlot key={key} leaving={leaving}>
          <article data-leaving={leaving}>
            {item.title}
            <button>Dismiss {item.title}</button>
          </article>
        </SlideSlot>
      ))}
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("retains removed records as inert exit snapshots without restarting their timeout on refresh", () => {
  vi.useFakeTimers();
  const { rerender } = render(
    <List
      items={[
        { id: "a", title: "First" },
        { id: "b", title: "Second" },
      ]}
    />,
  );
  rerender(<List items={[{ id: "b", title: "Second" }]} />);
  const removed = screen.getByText("First").closest(".notice-slot")!;
  expect(removed.hasAttribute("inert")).toBe(true);
  expect(removed.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  act(() => vi.advanceTimersByTime(200));
  rerender(
    <List
      items={[
        { id: "b", title: "Refreshed" },
        { id: "c", title: "New arrival" },
      ]}
    />,
  );
  act(() => vi.advanceTimersByTime(NOTICE_MOTION_MS - 200));
  expect(screen.queryByText("First")).toBeNull();
  expect(screen.getByText("New arrival")).toBeTruthy();
});
it("cancels stale removal when a record returns and resets snapshots on filter changes", () => {
  vi.useFakeTimers();
  const { rerender } = render(<List items={[{ id: "a", title: "First" }]} />);
  rerender(<List items={[]} />);
  act(() => vi.advanceTimersByTime(100));
  rerender(<List items={[{ id: "a", title: "Returned" }]} />);
  act(() => vi.advanceTimersByTime(NOTICE_MOTION_MS));
  expect(screen.getByRole("article").textContent).toContain("Returned");
  expect(
    screen.getByText("Returned").closest(".notice-slot")!.hasAttribute("inert"),
  ).toBe(false);
  rerender(<List items={[]} scope="unread" />);
  expect(screen.queryByText("Returned")).toBeNull();
});
