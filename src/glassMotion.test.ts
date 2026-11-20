// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  connectedControlPath,
  glassPressFrame,
  interpolateSurface,
  morphSurface,
} from "./glassMotion";
import { mockMotion } from "./testMotion";
let mock: ReturnType<typeof mockMotion>;
beforeEach(() => {
  document.documentElement.dataset.motion = "expressive";
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  mock = mockMotion();
});
afterEach(() => {
  mock.restore();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  delete document.documentElement.dataset.motion;
});
it("interpolates real bounds and curvature without invalid overshoot", () => {
  const a = { left: 10, top: 20, width: 60, height: 30, radius: 15 },
    b = { left: 20, top: 54, width: 240, height: 180, radius: 8 };
  expect(interpolateSurface(a, b, 0)).toEqual(a);
  expect(interpolateSurface(a, b, 1)).toEqual(b);
  expect(interpolateSurface(a, b, 0.5)).toEqual({
    left: 15,
    top: 37,
    width: 150,
    height: 105,
    radius: 11.5,
  });
  expect(interpolateSurface(a, b, 1.1)).toEqual(b);
});
it("shares one morph timeline with unscaled content and cleans up across completed and interrupted exits", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(240);
  const panel = document.createElement("div");
  panel.style.borderRadius = "8px";
  panel.style.background = "rgb(20, 20, 20)";
  document.body.append(panel);
  panel.getBoundingClientRect = () =>
    ({ left: 40, top: 60, width: 240, height: 180 }) as DOMRect;
  const motion = morphSurface(panel, () => ({
    left: 40,
    top: 24,
    width: 80,
    height: 32,
    radius: 6,
  }));
  motion.to(1);
  const opening = mock.animations[0];
  expect(opening.frames[0].width).toBe("80px");
  expect(opening.frames.at(-1)!.width).toBe("240px");
  expect(
    mock.animations[1].frames.every((frame) => frame.transform === "none"),
  ).toBe(true);
  opening.onfinish?.();
  expect(document.querySelector(".glass-morph-shell")).toBeNull();
  motion.to(0);
  const exit = mock.animations.at(-2)!,
    stale = exit.onfinish;
  exit.currentTime = 50;
  expect(document.querySelector(".glass-morph-shell")).toBeTruthy();
  motion.to(1);
  stale?.();
  expect(panel.hasAttribute("data-morphing")).toBe(true);
  motion.dispose();
  expect(document.querySelector(".glass-morph-shell")).toBeNull();
  expect(panel.style.clipPath).toBe("");
  expect(panel.style.background).toBe("rgb(20, 20, 20)");
});
it("settles the entire coordinated surface group under reduced motion", () => {
  const panel = document.createElement("div");
  document.body.append(panel);
  const done = vi.fn();
  document.documentElement.dataset.motion = "off";
  morphSurface(panel, () => ({
    left: 0,
    top: 0,
    width: 80,
    height: 32,
    radius: 6,
  })).to(1, done);
  expect(done).toHaveBeenCalledOnce();
  expect(mock.animations).toHaveLength(0);
  expect(document.querySelector(".glass-morph-shell")).toBeNull();
});
it("refreshes settled popup geometry and material before its exit", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(240);
  const panel = document.createElement("div");
  panel.style.background = "rgb(20, 20, 20)";
  document.body.append(panel);
  let height = 180;
  panel.getBoundingClientRect = () =>
    ({ left: 40, top: 60, width: 240, height }) as DOMRect;
  const motion = morphSurface(panel, () => ({
    left: 40,
    top: 24,
    width: 80,
    height: 32,
    radius: 6,
  }));
  motion.to(1);
  mock.animations[0].onfinish?.();
  height = 270;
  panel.style.background = "rgb(240, 240, 240)";
  motion.to(0);
  expect(mock.animations.at(-2)!.frames[0].height).toBe("270px");
  expect(
    (document.querySelector(".glass-morph-shell") as HTMLElement).style
      .background,
  ).toBe("rgb(240, 240, 240)");
  motion.dispose();
});
it("connects and separates one path with stable topology, while flexing only a surface", () => {
  const separated = connectedControlPath(80, 8, 32, 0),
    joined = connectedControlPath(80, 8, 32, 1);
  expect(separated.match(/[A-Za-z]/g)).toEqual(joined.match(/[A-Za-z]/g));
  expect(separated).not.toBe(joined);
  expect(separated).toContain("C 84 16 84 16 88 16");
  expect(glassPressFrame(0).transform).toBe("scale(1, 1)");
  expect(glassPressFrame(1).transform).toBe("scale(1.006, 0.974)");
});
