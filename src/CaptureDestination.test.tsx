// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CaptureDestination } from "./CaptureDestination";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("offers only valid destinations on hold and suppresses the ordinary submit", () => {
  vi.useFakeTimers();
  const onChoose = vi.fn();
  const submit = vi.fn((event) => event.preventDefault());
  const controls = (valid: boolean) => (
    <form onSubmit={submit}>
      <CaptureDestination valid={valid} busy={false} onChoose={onChoose} />
    </form>
  );
  const { rerender } = render(controls(false));
  const hold = () => {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Add to Inbox" }),
      { button: 0 },
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
  };
  hold();
  expect(
    screen.queryByRole("dialog", { name: "Capture destination" }),
  ).toBeNull();
  rerender(controls(true));
  hold();
  expect(
    screen.getByRole("dialog", { name: "Capture destination" }),
  ).toBeTruthy();
  fireEvent.pointerUp(screen.getByRole("button", { name: "Add to Inbox" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to Inbox" }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Dropped" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Resurfaced" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Current" }));
  expect(onChoose).toHaveBeenCalledWith({ destination: "DoNow" });
});
