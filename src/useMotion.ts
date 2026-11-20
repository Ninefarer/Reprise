import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  motionAllowed,
  springMotion,
  surfaceFrame,
  type MotionProfile,
  type SpringMotion,
} from "./motion";

export function useSurfacePresence<T extends HTMLElement>(
  open: boolean,
  ref: RefObject<T | null>,
  profile: MotionProfile = "fluid",
  frame = surfaceFrame,
) {
  const [retained, setRetained] = useState(open);
  const present = open || retained;
  const controller = useRef<SpringMotion | null>(null);
  useLayoutEffect(() => {
    if (!present || !ref.current) return;
    const spring = springMotion(ref.current, frame, profile);
    controller.current = spring;
    return () => {
      spring.dispose();
      controller.current = null;
    };
  }, [present, ref, profile, frame]);
  useLayoutEffect(() => {
    if (open) setRetained(true);
    controller.current?.to(open ? 1 : 0, () => {
      if (!open) setRetained(false);
    });
  }, [open, present]);
  return present;
}

export function useDialogMotion(
  ref: RefObject<HTMLDialogElement | null>,
  onClose: () => void,
  identity?: string,
) {
  const callback = useRef(onClose),
    controller = useRef<SpringMotion | null>(null);
  callback.current = onClose;
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.dataset.springSurface = "";
    const spring = springMotion(dialog, surfaceFrame, "gentle");
    controller.current = spring;
    spring.to(1);
    return () => {
      spring.dispose();
      controller.current = null;
    };
  }, [ref, identity]);
  return useCallback(
    (event?: { preventDefault: () => void }) => {
      event?.preventDefault();
      const dialog = ref.current;
      if (!dialog || dialog.inert) return;
      dialog.inert = true;
      controller.current?.to(0, () => callback.current());
    },
    [ref],
  );
}

/** One owner for tactile scale; no pointer tracking, frame loop or input delay. */
export function useTactileControls() {
  useEffect(() => {
    let pressed: HTMLElement | null = null;
    const controllers = new Map<HTMLElement, SpringMotion>();
    const release = () => {
      const node = pressed;
      pressed = null;
      if (!node) return;
      const controller = controllers.get(node);
      controller?.to(0, () => {
        controllers.delete(node);
        node.style.removeProperty("scale");
      });
    };
    const press = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const node = target.closest<HTMLElement>("button, summary");
      if (
        !node ||
        node.matches(":disabled, [aria-disabled=true]") ||
        node.closest("[inert]") ||
        !motionAllowed()
      )
        return;
      if (node !== pressed) release();
      pressed = node;
      let controller = controllers.get(node);
      if (!controller) {
        controller = springMotion(
          node,
          (p) => ({ scale: String(1 - 0.014 * p) }),
          "snappy",
        );
        controllers.set(node, controller);
      }
      controller.to(1);
    };
    const down = (event: PointerEvent) => {
      if (event.button === 0) press(event.target);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (
        !event.repeat &&
        (event.key === " " || event.key === "Enter") &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      )
        press(event.target);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") release();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("keyup", keyUp, true);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("keyup", keyUp, true);
      window.removeEventListener("blur", release);
      controllers.forEach((controller, node) => {
        controller.dispose();
        node.style.removeProperty("scale");
      });
    };
  }, []);
}
