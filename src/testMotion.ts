import { vi } from "vitest";

/** Explicit finite WAAPI clock for lifecycle tests; jsdom has no compositor. */
export function mockMotion() {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  );
  const animations: {
    element: HTMLElement;
    frames: Keyframe[];
    currentTime: number;
    onfinish: (() => void) | null;
    cancel: ReturnType<typeof vi.fn>;
  }[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: function (this: HTMLElement, frames: Keyframe[]) {
      const animation = {
        element: this,
        frames,
        currentTime: 0,
        onfinish: null as (() => void) | null,
        cancel: vi.fn(),
      };
      animations.push(animation);
      return animation;
    },
  });
  return {
    animations,
    restore() {
      if (original)
        Object.defineProperty(HTMLElement.prototype, "animate", original);
      else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    },
  };
}
