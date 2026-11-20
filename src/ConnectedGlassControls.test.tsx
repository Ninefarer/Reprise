// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConnectedGlassControls } from "./ConnectedGlassControls";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.motion;
});
it("removes a held connection on reduced motion and resize", async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  if (typeof PointerEvent === "undefined")
    vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        left: this.textContent === "Later" ? 88 : 0,
        right: this.textContent === "Later" ? 168 : 80,
        top: 0,
        width: 80,
        height: 32,
      } as DOMRect;
    },
  );
  render(
    <ConnectedGlassControls className="test">
      <button>Now</button>
      <button>Later</button>
    </ConnectedGlassControls>,
  );
  fireEvent.keyDown(screen.getByText("Now"), { key: " " });
  expect(document.querySelector(".connected-glass-rim")).toBeTruthy();
  document.documentElement.dataset.motion = "off";
  await act(async () => {});
  expect(document.querySelector(".connected-glass-rim")).toBeNull();
  document.documentElement.dataset.motion = "expressive";
  await act(async () => {});
  fireEvent.keyDown(screen.getByText("Now"), { key: " " });
  expect(document.querySelector(".connected-glass-rim")).toBeTruthy();
  fireEvent(window, new Event("resize"));
  expect(document.querySelector(".connected-glass-rim")).toBeNull();
});
