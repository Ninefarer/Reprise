// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { DELETE_UNDO_MS, UndoToast, type UndoNotice } from "./UndoToast";
const notice: UndoNotice = {
  key: "one",
  id: "task",
  revision: 1,
  title: "Example",
  deletionToken: "token",
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function setup(entry = notice) {
  const onUndo = vi.fn(async () => true),
    onDone = vi.fn(),
    onExpire = vi.fn();
  render(
    <UndoToast
      notice={entry}
      onUndo={onUndo}
      onDone={onDone}
      onExpire={onExpire}
    />,
  );
  return { onUndo, onDone, onExpire };
}
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
it("pauses deletion countdown on repeated hover and resumes only its remaining time", () => {
  const { onDone, onExpire } = setup();
  const toast = screen.getByRole("status");
  expect(screen.getByText("Click undo to revert the deletion.")).toBeTruthy();
  advance(10000);
  fireEvent.mouseEnter(toast);
  advance(60000);
  expect(onExpire).not.toHaveBeenCalled();
  expect(
    (toast.querySelector(".undo-drain > div") as HTMLElement).style
      .animationPlayState,
  ).toBe("paused");
  fireEvent.mouseLeave(toast);
  advance(5000);
  fireEvent.mouseEnter(toast);
  advance(60000);
  fireEvent.mouseLeave(toast);
  advance(14999);
  expect(onExpire).not.toHaveBeenCalled();
  advance(1);
  expect(onExpire).toHaveBeenCalledOnce();
  expect(onDone).not.toHaveBeenCalled();
  advance(220);
  expect(onDone).toHaveBeenCalledOnce();
});
it("locks expiration before slide-out and ignores hover, undo and dismiss during exit", () => {
  const { onUndo, onExpire, onDone } = setup();
  const toast = screen.getByRole("status");
  advance(DELETE_UNDO_MS);
  expect(toast.getAttribute("data-leaving")).toBe("true");
  fireEvent.mouseEnter(toast);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  fireEvent.click(screen.getByLabelText("Dismiss undo"));
  expect(onUndo).not.toHaveBeenCalled();
  expect(onExpire).toHaveBeenCalledOnce();
  advance(220);
  expect(onDone).toHaveBeenCalledOnce();
});
it("keeps updates without a timer until dismissed and slides them out", () => {
  const { onDone } = setup({ ...notice, deletionToken: undefined });
  advance(300000);
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.getByRole("status").querySelector(".undo-drain")).toBeNull();
  fireEvent.click(screen.getByLabelText("Dismiss undo"));
  expect(screen.getByRole("status").getAttribute("data-leaving")).toBe("true");
  advance(220);
  expect(onDone).toHaveBeenCalledOnce();
});
it("pauses on focus and pending undo, keeps failed undo available, then exits on success", async () => {
  const { onUndo, onExpire, onDone } = setup();
  const undo = screen.getByRole("button", { name: "Undo" });
  fireEvent.focus(undo);
  advance(DELETE_UNDO_MS * 2);
  expect(onExpire).not.toHaveBeenCalled();
  onUndo.mockResolvedValueOnce(false);
  await act(async () => {
    fireEvent.click(undo);
  });
  expect(screen.getByRole("status").getAttribute("data-leaving")).toBe("false");
  await act(async () => {
    fireEvent.click(undo);
  });
  expect(onUndo).toHaveBeenCalledTimes(2);
  expect(onExpire).not.toHaveBeenCalled();
  advance(220);
  expect(onDone).toHaveBeenCalledOnce();
});
it("does not double-submit Undo and holds the timer while the backend is pending", async () => {
  const { onUndo, onExpire } = setup();
  let resolve!: (value: boolean) => void;
  onUndo.mockImplementation(
    () =>
      new Promise<boolean>((r) => {
        resolve = r;
      }),
  );
  const undo = screen.getByRole("button", { name: "Undo" });
  fireEvent.click(undo);
  fireEvent.click(undo);
  advance(DELETE_UNDO_MS * 2);
  expect(onUndo).toHaveBeenCalledOnce();
  expect(onExpire).not.toHaveBeenCalled();
  await act(async () => {
    resolve(true);
  });
  expect(screen.getByRole("status").getAttribute("data-leaving")).toBe("true");
});
