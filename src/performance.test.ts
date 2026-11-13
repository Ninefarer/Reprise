// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  history.replaceState({}, "", "/");
  delete (window as any).__reprisePerformance;
  vi.resetModules();
});
it("does no recording on normal launches", async () => {
  const perf = await import("./performance");
  expect(perf.traceStart()).toBeNull();
  perf.trace("ignored", 0);
  expect((window as any).__reprisePerformance).toBeUndefined();
});
it("bounds opt-in diagnostics and retains counts without task text", async () => {
  history.replaceState({}, "", "/?perf=1&capture=1");
  const perf = await import("./performance");
  const start = perf.traceStart();
  perf.traceSnapshot("snapshot.test", start, {
    tasks: [{ title: "Private task text" }],
    notifications: [],
    performance: { mutex_wait_ms: 1 },
  });
  const report = (window as any).__reprisePerformance;
  expect(report.samples[0]).toMatchObject({
    window: "capture",
    values: { tasks: 1, notifications: 0, mutex_wait_ms: 1 },
  });
  expect(JSON.stringify(report.samples)).not.toContain("Private task text");
  for (let i = 0; i < 300; i++) perf.trace("bounded", start);
  expect(report.samples).toHaveLength(256);
  expect(report.summary()[0].count).toBe(256);
  report.clear();
  expect(report.samples).toHaveLength(0);
});
