// Read-only instrumentation of an explicitly launched QA WebView2.
// No UI automation, screenshot substitution, settings writes or native sampling.
// node scripts/performance/measure-glass-native.mjs <label> [seconds=10]
import { writeFile, mkdir } from "node:fs/promises";
const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label ?? "")) throw Error("Supply a safe run label");
const seconds = Number(process.argv[3] ?? 10);
if (!(seconds >= 2 && seconds <= 30)) throw Error("Use a 2–30 second sample");
const targets = await (await fetch("http://127.0.0.1:9227/json/list")).json();
const target = targets.find(
  (t) => t.type === "page" && t.url === "http://127.0.0.1:5179/",
);
if (!target) throw Error("Isolated native QA target not found");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let id = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.id) {
    const task = pending.get(data.id);
    pending.delete(data.id);
    data.error
      ? task.reject(Error(JSON.stringify(data.error)))
      : task.resolve(data.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
try {
  await send("Performance.enable");
  const before = await send("Performance.getMetrics");
  const result = await send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `
    new Promise(resolve => {
      const gaps=[], tasks=[], events=[], resizes=[]; let previous, started;
      const initialViewport=[innerWidth,innerHeight];
      const resized=()=>resizes.push({atMs:performance.now()-(started??performance.now()),width:innerWidth,height:innerHeight});
      window.addEventListener('resize',resized);
      const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));
      observer.observe({type:'longtask'});
      const eventObserver=new PerformanceObserver(list=>events.push(...list.getEntries().filter(e=>e.interactionId).map(e=>({type:e.name,durationMs:e.duration}))));
      eventObserver.observe({type:'event',durationThreshold:16});
      function frame(now) {
        started ??= now;
        if(previous !== undefined) gaps.push(now-previous);
        previous=now;
        if(now-started < ${seconds * 1000}) requestAnimationFrame(frame);
        else {
          observer.disconnect(); eventObserver.disconnect(); window.removeEventListener('resize',resized); const sorted=[...gaps].sort((a,b)=>a-b);
          const q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
          const root=document.documentElement, style=getComputedStyle(root);
          resolve({durationMs:now-started, frames:gaps.length, medianMs:q(.5), p95Ms:q(.95), p99Ms:q(.99), maxMs:q(1), gapsOver25ms:gaps.filter(n=>n>25).length, gapsOver50ms:gaps.filter(n=>n>50).length, longTasks:tasks, interactionsOverThreshold:events, initialViewport, resizes, visibility:document.visibilityState, focused:document.hasFocus(), dpr:devicePixelRatio, viewport:[innerWidth,innerHeight], mode:root.dataset.desktopGlass, variant:root.dataset.glassVariant, nativeError:root.dataset.desktopGlassError, motion:root.dataset.motion, active:root.dataset.windowActive, materialCoverage:style.getPropertyValue('--material-coverage').trim(), theme:root.dataset.theme, tasks:document.querySelectorAll('.task-card').length, popups:document.querySelectorAll('.control-popup').length});
        }
      } requestAnimationFrame(frame);
    })`,
  });
  if (result.exceptionDetails)
    throw Error(JSON.stringify(result.exceptionDetails));
  const after = await send("Performance.getMetrics");
  const metrics = Object.fromEntries(
    after.metrics.map((m) => [
      m.name,
      m.value - (before.metrics.find((b) => b.name === m.name)?.value ?? 0),
    ]),
  );
  const report = {
    label,
    recordedAt: new Date().toISOString(),
    ...result.result.value,
    taskDurationMs: metrics.TaskDuration * 1000,
    scriptDurationMs: metrics.ScriptDuration * 1000,
    layoutDurationMs: metrics.LayoutDuration * 1000,
    recalcDurationMs: metrics.RecalcStyleDuration * 1000,
    notes: [
      "Debug Tauri/WebView2; rAF instrumentation present in all compared runs",
      "rAF intervals measure renderer scheduling, not DWM presentation or input latency",
      "GPU/CPU samples are recorded separately; no optical refraction measurement",
    ],
  };
  await mkdir("artifacts/glass/runtime", { recursive: true });
  await writeFile(
    `artifacts/glass/runtime/${label}-frames.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  socket.close();
}
