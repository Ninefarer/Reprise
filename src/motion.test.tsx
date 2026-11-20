// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sampleSpring, springMotion } from "./motion";
import { mockMotion } from "./testMotion";
import { Select } from "./Select";
import { useTactileControls } from "./useMotion";
import { QuickCapture } from "./QuickCapture";
import { hideQuickCapture } from "./captureMotion";
const native = vi.hoisted(() => ({
  hide: vi.fn(async () => {}),
  reveal: () => {},
  off: vi.fn(),
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => native }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_: string, callback: () => void) => {
    native.reveal = callback;
    return native.off;
  }),
}));
let mock: ReturnType<typeof mockMotion>;
beforeEach(() => {
  document.documentElement.dataset.motion = "expressive";
  window.matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  mock = mockMotion();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  mock.restore();
  delete document.documentElement.dataset.motion;
});
it("solves critical and underdamped springs with continuous position and velocity", () => {
  for (const damping of [0.9, 1]) {
    const initial = { position: 0.2, velocity: 0.7 };
    expect(sampleSpring(initial, 1, 0, 38, damping).position).toBeCloseTo(
      initial.position,
      12,
    );
    expect(sampleSpring(initial, 1, 0, 38, damping).velocity).toBeCloseTo(
      initial.velocity,
      12,
    );
    const middle = sampleSpring(initial, 1, 0.07, 38, damping);
    const whole = sampleSpring(initial, 1, 0.15, 38, damping);
    const resumed = sampleSpring(middle, 1, 0.08, 38, damping);
    expect(resumed.position).toBeCloseTo(whole.position, 10);
    expect(resumed.velocity).toBeCloseTo(whole.velocity, 10);
    expect(sampleSpring(initial, 1, 1, 38, damping).position).toBeCloseTo(1, 8);
  }
});
it("reverses from the analytical position and velocity and ignores stale completions", () => {
  const element = document.createElement("div"),
    oldRest = vi.fn(),
    rest = vi.fn();
  const spring = springMotion(element, (p) => ({ opacity: String(p) }));
  spring.to(1, oldRest);
  const opening = mock.animations[0],
    stale = opening.onfinish;
  opening.currentTime = 70;
  const current = sampleSpring({ position: 0, velocity: 0 }, 1, 0.07, 38, 0.9);
  spring.to(0, rest);
  const closing = mock.animations[1];
  expect(Number(closing.frames[0].opacity)).toBeCloseTo(current.position, 10);
  expect(Number(closing.frames[1].opacity)).toBeCloseTo(
    sampleSpring(current, 0, 1 / 120, 38, 0.9).position,
    10,
  );
  stale?.();
  expect(oldRest).not.toHaveBeenCalled();
  expect(rest).not.toHaveBeenCalled();
  closing.onfinish?.();
  expect(rest).toHaveBeenCalledOnce();
  expect(element.style.opacity).toBe("0");
  expect(closing.cancel).toHaveBeenCalledOnce();
  spring.dispose();
});
it("settles an active animation when reduced motion is enabled", async () => {
  const element = document.createElement("div"),
    rest = vi.fn();
  const spring = springMotion(element, (p) => ({ opacity: String(p) }));
  spring.to(1, rest);
  document.documentElement.dataset.motion = "off";
  await act(async () => {});
  expect(rest).toHaveBeenCalledOnce();
  expect(element.style.opacity).toBe("1");
  spring.dispose();
});
it("retains only an inert popup during close, restores focus immediately, and cancels stale removal", () => {
  const view = render(
    <Select value="a" onChange={vi.fn()}>
      <option value="a">Alpha</option>
    </Select>,
  );
  const trigger = screen.getByRole("combobox");
  fireEvent.click(trigger);
  mock.animations.at(-1)!.currentTime = 80;
  fireEvent.keyDown(screen.getByRole("option"), { key: "Escape" });
  const closing = mock.animations.at(-1)!,
    stale = closing.onfinish;
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(document.querySelector(".control-shield")?.hasAttribute("inert")).toBe(
    true,
  );
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  act(() => stale?.());
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(document.querySelectorAll(".control-popup")).toHaveLength(1);
  view.unmount();
  expect(mock.animations.at(-1)!.cancel).toHaveBeenCalledOnce();
});
it("never presses disabled controls and retargets press/release without queues", () => {
  function Controls() {
    useTactileControls();
    return (
      <>
        <button>Go</button>
        <button disabled>Disabled</button>
      </>
    );
  }
  render(<Controls />);
  fireEvent.pointerDown(screen.getByText("Disabled"), { button: 0 });
  expect(mock.animations).toHaveLength(0);
  fireEvent.keyDown(screen.getByText("Go"), { key: " " });
  mock.animations.at(-1)!.currentTime = 30;
  fireEvent.keyUp(screen.getByText("Go"), { key: " " });
  const release = mock.animations.at(-1)!,
    stale = release.onfinish;
  release.currentTime = 20;
  fireEvent.keyDown(screen.getByText("Go"), { key: " " });
  act(() => stale?.());
  expect(release.cancel).toHaveBeenCalledOnce();
  expect(mock.animations.at(-1)!.frames.at(-1)!.scale).toBe("0.986");
});
it("cancels a pending native capture hide on reveal and focuses without waiting", async () => {
  render(
    <QuickCapture error="" busy={false} onError={vi.fn()}>
      <input aria-label="Capture" />
    </QuickCapture>,
  );
  expect(document.activeElement).toBe(screen.getByLabelText("Capture"));
  mock.animations.at(-1)!.currentTime = 80;
  const pending = hideQuickCapture(),
    stale = mock.animations.at(-1)!.onfinish;
  act(() => native.reveal());
  act(() => stale?.());
  await pending;
  expect(native.hide).not.toHaveBeenCalled();
  expect(document.querySelector("main")!.inert).toBe(false);
  expect(document.activeElement).toBe(screen.getByLabelText("Capture"));
  const exit = hideQuickCapture();
  act(() => mock.animations.at(-1)!.onfinish?.());
  await exit;
  expect(native.hide).toHaveBeenCalledOnce();
});
