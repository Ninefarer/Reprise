// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AvatarEditor } from "./Profile";
import { panCrop } from "./avatarCrop";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
const drawImage = vi.fn();
beforeEach(() => {
  invoke.mockReset().mockResolvedValue(undefined);
  drawImage.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,cropped",
  );
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getBoundingClientRect",
  ).mockReturnValue({ width: 140, height: 140 } as DOMRect);
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
      }
    },
  );
  for (const name of [
    "setPointerCapture",
    "hasPointerCapture",
    "releasePointerCapture",
  ]) {
    Object.defineProperty(HTMLCanvasElement.prototype, name, {
      configurable: true,
      value: vi.fn(() => true),
    });
  }
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 800, height: 400, close: vi.fn() }),
  );
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 800;
      naturalHeight = 400;
      onload = () => {};
      set src(_: string) {
        queueMicrotask(() => this.onload());
      }
    },
  );
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function openCrop() {
  const user = userEvent.setup();
  const saved = vi.fn().mockResolvedValue(undefined);
  const view = render(<AvatarEditor name="Test" onSaved={saved} />);
  await user.upload(
    view.container.querySelector('input[type="file"]')!,
    new File(["image"], "avatar.png", { type: "image/png" }),
  );
  const preview = await screen.findByRole("application", {
    name: "Profile avatar crop preview",
  });
  return { user, preview, saved };
}
it("converts dragging into bounded crops for landscape, portrait and zoomed square images", () => {
  expect(panCrop(50, 35, 800, 400, 140)).toBe(25);
  expect(panCrop(50, -35, 800, 400, 140)).toBe(75);
  expect(panCrop(50, 999, 800, 400, 140)).toBe(0);
  expect(panCrop(50, -999, 800, 400, 140)).toBe(100);
  expect(panCrop(50, 35, 400, 400, 140)).toBe(50);
  expect(panCrop(50, 35, 400, 200, 140)).toBe(25);
  expect(panCrop(50, 35, 800, 400, 0)).toBe(50);
});
it("drags the preview in pointer direction, clamps the edge and ends on capture loss", async () => {
  const { preview, user, saved } = await openCrop();
  expect(screen.queryByRole("slider")).toBeNull();
  expect(drawImage.mock.lastCall?.[1]).toBe(200);
  fireEvent.pointerDown(preview, {
    pointerId: 1,
    clientX: 50,
    clientY: 50,
    button: 0,
  });
  fireEvent.pointerMove(preview, { pointerId: 1, clientX: 85, clientY: 90 });
  expect(drawImage.mock.lastCall?.slice(1, 5)).toEqual([100, 0, 400, 400]);
  fireEvent.pointerMove(preview, { pointerId: 1, clientX: 900, clientY: 90 });
  expect(drawImage.mock.lastCall?.[1]).toBe(0);
  fireEvent.lostPointerCapture(preview, { pointerId: 1 });
  fireEvent.pointerMove(preview, { pointerId: 1, clientX: -900, clientY: 90 });
  expect(drawImage.mock.lastCall?.[1]).toBe(0);
  await user.click(screen.getByRole("button", { name: "Save avatar" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(invoke).toHaveBeenCalledWith("save_avatar", { pngBase64: "cropped" });
});
it("offers bounded wheel/button/keyboard zoom, keyboard panning, reset and cancellation", async () => {
  const { preview, user } = await openCrop();
  fireEvent.wheel(preview, { deltaY: -100 });
  expect(screen.getByLabelText("Zoom level").textContent).toBe("110%");
  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByLabelText("Zoom level").textContent).toBe("120%");
  fireEvent.keyDown(preview, { key: "ArrowLeft" });
  expect(drawImage.mock.lastCall?.[1]).toBeGreaterThan((800 - 400 / 1.2) / 2);
  for (let i = 0; i < 50; i++) fireEvent.wheel(preview, { deltaY: -100 });
  expect(screen.getByLabelText("Zoom level").textContent).toBe("400%");
  expect(
    (screen.getByRole("button", { name: "Zoom in" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Reset crop" }));
  expect(drawImage.mock.lastCall?.slice(1, 5)).toEqual([200, 0, 400, 400]);
  fireEvent.keyDown(preview, { key: "-" });
  expect(screen.getByLabelText("Zoom level").textContent).toBe("100%");
  await user.click(screen.getByRole("button", { name: "Cancel crop" }));
  expect(screen.queryByRole("application")).toBeNull();
  expect(invoke).not.toHaveBeenCalled();
});
it("keeps the crop available when saving fails", async () => {
  const { user } = await openCrop();
  invoke.mockRejectedValueOnce("Could not save avatar");
  await user.click(screen.getByRole("button", { name: "Save avatar" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not save avatar",
  );
  expect(screen.getByRole("application")).toBeTruthy();
});
