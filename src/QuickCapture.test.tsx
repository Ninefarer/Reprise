// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuickCapture } from "./QuickCapture";
const windowMock = vi.hoisted(() => ({ setSize: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowMock,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("fits capture content, grows for errors and disconnects its observer on unmount", async () => {
  let notify = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  let height = 102;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ height }) as DOMRect,
  );
  windowMock.setSize.mockResolvedValue(undefined);
  const onError = vi.fn();
  const view = render(
    <QuickCapture error="" busy={false} onError={onError}>
      <input />
    </QuickCapture>,
  );
  await waitFor(() =>
    expect(windowMock.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ height: 102 }),
    ),
  );
  height = 146;
  act(() => notify());
  await waitFor(() =>
    expect(windowMock.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ height: 146 }),
    ),
  );
  height = 102;
  windowMock.setSize.mockRejectedValueOnce(Error("resize failed"));
  act(() => notify());
  await waitFor(() =>
    expect(onError).toHaveBeenCalledWith("Error: resize failed"),
  );
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
