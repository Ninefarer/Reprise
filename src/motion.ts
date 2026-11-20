/** Finite compositor animations sampled from a physical damped spring. */
export const motionProfiles = {
  snappy: { frequency: 70, damping: 1 },
  fluid: { frequency: 38, damping: 0.9 },
  gentle: { frequency: 34, damping: 1 },
  decisive: { frequency: 48, damping: 1 },
} as const;
export type MotionProfile = keyof typeof motionProfiles;
export interface SpringState {
  position: number;
  velocity: number;
}

export function sampleSpring(
  from: SpringState,
  target: number,
  seconds: number,
  frequency: number,
  damping: number,
): SpringState {
  const t = Math.max(0, seconds),
    x = from.position - target;
  if (damping >= 1) {
    const b = from.velocity + frequency * x,
      decay = Math.exp(-frequency * t);
    return {
      position: target + (x + b * t) * decay,
      velocity: (from.velocity - frequency * b * t) * decay,
    };
  }
  const a = damping * frequency,
    w = frequency * Math.sqrt(1 - damping * damping);
  const b = (from.velocity + a * x) / w,
    decay = Math.exp(-a * t);
  const displacement = x * Math.cos(w * t) + b * Math.sin(w * t);
  return {
    position: target + decay * displacement,
    velocity:
      decay *
      ((b * w - a * x) * Math.cos(w * t) - (x * w + a * b) * Math.sin(w * t)),
  };
}

export function motionAllowed() {
  const root = document.documentElement;
  return (
    root.dataset.motion !== "off" &&
    root.dataset.windowActive !== "false" &&
    document.visibilityState !== "hidden" &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
    !window.matchMedia?.("(forced-colors: active)").matches
  );
}

// Share policy listeners across active animations, with no listeners left at rest.
const policyListeners = new Set<() => void>();
let removePolicyListeners: (() => void) | undefined;
export function observeMotionPolicy(callback: () => void) {
  policyListeners.add(callback);
  if (!removePolicyListeners) {
    const settle = () => [...policyListeners].forEach((fn) => fn());
    const observer = new MutationObserver((records) => {
      if (
        !motionAllowed() ||
        records.some(
          (record) =>
            record.oldValue !==
            document.documentElement.getAttribute(record.attributeName!),
        )
      )
        settle();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        "data-motion",
        "data-window-active",
        "data-family",
        "data-aesthetic",
        "data-theme",
        "data-effects",
        "data-glass-variant",
        "data-desktop-glass",
        "class",
        "style",
      ],
    });
    const media = [
      "(prefers-reduced-motion: reduce)",
      "(forced-colors: active)",
      "(prefers-reduced-transparency: reduce)",
      "(prefers-contrast: more)",
    ].map((query) => window.matchMedia?.(query));
    media.forEach((query) => query?.addEventListener?.("change", settle));
    document.addEventListener("visibilitychange", settle);
    removePolicyListeners = () => {
      observer.disconnect();
      media.forEach((query) => query?.removeEventListener?.("change", settle));
      document.removeEventListener("visibilitychange", settle);
    };
  }
  return () => {
    policyListeners.delete(callback);
    if (!policyListeners.size) {
      removePolicyListeners?.();
      removePolicyListeners = undefined;
    }
  };
}

export function springMotion(
  element: HTMLElement,
  frame: (progress: number) => Record<string, string>,
  profile: MotionProfile = "fluid",
  initial = 0,
  tracks: {
    element: HTMLElement;
    frame: (progress: number) => Record<string, string>;
  }[] = [],
) {
  let state: SpringState = { position: initial, velocity: 0 },
    target = initial;
  let active: Animation | undefined, unsubscribe: (() => void) | undefined;
  let start = state,
    physics = { frequency: 38, damping: 1 },
    settled: (() => void) | undefined;
  let generation = 0;
  let followers: Animation[] = [];
  const apply = (position: number) => {
    Object.assign(element.style, frame(position));
    tracks.forEach((track) =>
      Object.assign(track.element.style, track.frame(position)),
    );
  };
  const cancel = () => {
    generation++;
    followers.forEach((animation) => animation.cancel());
    followers = [];
    if (active) {
      active.onfinish = null;
      active.cancel();
      active = undefined;
    }
    unsubscribe?.();
    unsubscribe = undefined;
  };
  const finish = () => {
    const callback = settled;
    settled = undefined;
    cancel();
    state = { position: target, velocity: 0 };
    apply(target);
    callback?.();
  };
  return {
    to(next: number, onRest?: () => void) {
      if (active)
        state = sampleSpring(
          start,
          target,
          Number(active.currentTime ?? 0) / 1000,
          physics.frequency,
          physics.damping,
        );
      cancel();
      target = next;
      settled = onRest;
      if (
        Math.abs(state.position - target) < 0.001 &&
        Math.abs(state.velocity) < 0.02
      ) {
        finish();
        return;
      }
      if (!motionAllowed() || typeof element.animate !== "function") {
        finish();
        return;
      }
      const chosen = motionProfiles[profile];
      const expressive =
        document.documentElement.dataset.motion === "expressive";
      physics = {
        frequency: chosen.frequency * (expressive ? 1 : 1.12),
        damping: expressive ? chosen.damping : 1,
      };
      start = state;
      const frames: Keyframe[] = [];
      const values: number[] = [];
      let duration = 0;
      for (let step = 0; step <= 72; step++) {
        duration = step * (1000 / 120);
        const sampled = sampleSpring(
          start,
          target,
          duration / 1000,
          physics.frequency,
          physics.damping,
        );
        frames.push(frame(sampled.position));
        values.push(sampled.position);
        if (
          step > 0 &&
          Math.abs(sampled.position - target) < 0.001 &&
          Math.abs(sampled.velocity) < 0.02
        )
          break;
      }
      frames[frames.length - 1] = frame(target);
      values[values.length - 1] = target;
      if (duration === 0) {
        finish();
        return;
      }
      const current = generation;
      active = element.animate(frames, {
        duration,
        easing: "linear",
        fill: "both",
      });
      followers = tracks.map((track) =>
        track.element.animate(values.map(track.frame), {
          duration,
          easing: "linear",
          fill: "both",
        }),
      );
      active.onfinish = () => {
        if (generation === current) finish();
      };
      unsubscribe = observeMotionPolicy(finish);
    },
    finish,
    dispose() {
      settled = undefined;
      cancel();
    },
  };
}
export type SpringMotion = ReturnType<typeof springMotion>;
export const surfaceFrame = (p: number) => ({
  opacity: String(Math.max(0, Math.min(1, p))),
  transform: `translateY(${(1 - p) * 3}px) scale(${0.98 + p * 0.02})`,
});
