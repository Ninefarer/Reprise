// @vitest-environment jsdom
import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTaskLayout } from "./LayoutMotion";
import { mockMotion } from "./testMotion";
let motion: ReturnType<typeof mockMotion>;
function List({ ids, scope = "Inbox" }: { ids: string[]; scope?: string }) {
  const root = useRef<HTMLElement>(null);
  useTaskLayout(root, scope, ids);
  return (
    <main ref={root}>
      {ids.map((id, index) => (
        <article key={id} data-motion-task={id} data-top={index * 80}>
          <button>{id}</button>
        </article>
      ))}
    </main>
  );
}
beforeEach(() => {
  document.documentElement.dataset.motion = "expressive";
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    function (this: HTMLElement) {
      return Number(this.dataset.top || 0);
    },
  );
  motion = mockMotion();
});
afterEach(() => {
  cleanup();
  motion.restore();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.motion;
});
it("does not remeasure task rows for unrelated renders", () => {
  const read = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
  const ids = ["a", "b"],
    view = render(<List ids={ids} />);
  const count = read.mock.calls.length;
  view.rerender(<List ids={ids} />);
  expect(read).toHaveBeenCalledTimes(count);
  view.rerender(<List ids={[...ids]} />);
  expect(read.mock.calls.length).toBeGreaterThan(count);
});
it("moves remaining rows immediately and retains only an inert exit snapshot", () => {
  const view = render(<List ids={["a", "b"]} />);
  view.rerender(<List ids={["b"]} />);
  const ghost = document.querySelector<HTMLElement>("[data-motion-ghost]")!;
  expect(ghost.inert).toBe(true);
  expect(ghost.getAttribute("aria-hidden")).toBe("true");
  expect(ghost.hasAttribute("data-motion-task")).toBe(false);
  expect(document.querySelectorAll("[data-motion-task]")).toHaveLength(1);
  const shift = motion.animations.find(
    (a) => a.element.dataset.motionTask === "b",
  )!;
  expect(shift.frames[0].transform).toBe("translate(0px, 80px)");
  act(() => motion.animations.find((a) => a.element === ghost)!.onfinish?.());
  expect(document.querySelector("[data-motion-ghost]")).toBeNull();
  view.unmount();
  expect(shift.cancel).toHaveBeenCalledOnce();
});
it("does not retain outgoing content across navigation or reduced motion", () => {
  const view = render(<List ids={["a"]} />);
  view.rerender(<List ids={["b"]} scope="Scheduled" />);
  expect(document.querySelector("[data-motion-ghost]")).toBeNull();
  document.documentElement.dataset.motion = "off";
  view.rerender(<List ids={[]} scope="Scheduled" />);
  expect(document.querySelector("[data-motion-ghost]")).toBeNull();
});
