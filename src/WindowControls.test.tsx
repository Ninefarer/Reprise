// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WindowControls } from "./WindowControls";

const window = vi.hoisted(() => ({
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  startDragging: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => window }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("routes controls through the native window lifecycle and excludes buttons from dragging", async () => {
  const { container } = render(<WindowControls />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
  fireEvent.click(screen.getByRole("button", { name: "Maximize or restore" }));
  const close = screen.getByRole("button", { name: "Close window" });
  fireEvent.pointerDown(close, { button: 0 });
  fireEvent.click(close);
  expect(window.minimize).toHaveBeenCalledOnce();
  expect(window.toggleMaximize).toHaveBeenCalledOnce();
  expect(window.close).toHaveBeenCalledOnce();
  expect(window.startDragging).not.toHaveBeenCalled();
  fireEvent.doubleClick(container.querySelector(".window-drag")!);
  expect(window.toggleMaximize).toHaveBeenCalledTimes(2);
});

it("reports native control failures without removing the controls", async () => {
  window.close.mockRejectedValueOnce(new Error("native failure"));
  render(<WindowControls />);
  fireEvent.click(screen.getByRole("button", { name: "Close window" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Could not close window"));
  expect(screen.getByRole("button", { name: "Minimize" })).toBeTruthy();
});
