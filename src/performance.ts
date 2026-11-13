// Explicit, per-window QA opt-in. Nothing is recorded or persisted on ordinary launches.
export interface PerformanceSample {
  phase: string;
  duration_ms: number;
  at_ms: number;
  window: "main" | "capture";
  values: Record<string, number | string>;
}
const params = new URLSearchParams(location.search);
const enabled = params.get("perf") === "1";
const samples: PerformanceSample[] = [];
const windowKind = params.has("capture") ? "capture" : "main";
export function traceStart() {
  return enabled ? performance.now() : null;
}
export function trace(
  phase: string,
  start: number | null,
  values: Record<string, number | string> = {},
) {
  if (!enabled || start === null) return;
  samples.push({
    phase,
    duration_ms: performance.now() - start,
    at_ms: performance.now(),
    window: windowKind,
    values,
  });
  if (samples.length > 256) samples.splice(0, samples.length - 256);
}
export function traceSnapshot(
  phase: string,
  start: number | null,
  snapshot: unknown,
) {
  if (start === null) return;
  const data = snapshot as {
    tasks: unknown[];
    notifications: unknown[];
    performance?: Record<string, number>;
  };
  trace(phase, start, {
    tasks: data.tasks.length,
    notifications: data.notifications.length,
    bytes: new TextEncoder().encode(JSON.stringify(snapshot)).length,
    ...data.performance,
  });
}
if (enabled) {
  Object.assign(window, {
    __reprisePerformance: {
      samples,
      clear: () => samples.splice(0),
      summary: () =>
        [...new Set(samples.map((s) => s.phase))].map((phase) => {
          const durations = samples
            .filter((s) => s.phase === phase)
            .map((s) => s.duration_ms)
            .sort((a, b) => a - b);
          return {
            phase,
            count: durations.length,
            median_ms: durations[Math.floor(durations.length / 2)],
            p95_ms:
              durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)],
          };
        }),
    },
  });
}
