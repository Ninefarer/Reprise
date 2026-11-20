// Summarize installed release-build runs. Never treat rAF as GPU frame time.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const labels = process.argv.slice(2);
if (!labels.length || labels.some((label) => !/^[a-z0-9-]+$/.test(label)))
  throw Error("Supply measured run labels");
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const rows = [];
for (const label of labels) {
  const motion = await read(`artifacts/motion/${label}.json`);
  const process = await read(`artifacts/glass/runtime/${label}-process.json`);
  const samples = process.samples.filter(
    (sample) =>
      Date.parse(sample.at) >= Date.parse(motion.startedAt) &&
      Date.parse(sample.at) <= Date.parse(motion.finishedAt),
  );
  if (!samples.length) throw Error(`No overlapping samples for ${label}`);
  const peak = (key) => {
    const values = samples
      .map((sample) => sample[key])
      .filter((value) => value != null);
    return values.length ? Math.max(...values) : null;
  };
  rows.push({
    label,
    version: process.appVersion,
    samples: samples.length,
    workloadSeconds:
      (Date.parse(motion.finishedAt) - Date.parse(motion.startedAt)) / 1000,
    cpuMean:
      samples.reduce((sum, sample) => sum + sample.cpuMachinePercent, 0) /
      samples.length,
    gpuPeak: peak("busiestGpuEnginePercent"),
    privatePeakMiB: peak("privateMiB"),
    gpuDedicatedPeakMiB: peak("gpuDedicatedMiB"),
    gpuSharedPeakMiB: peak("gpuSharedMiB"),
    frameP95: motion.metrics.frameIntervals.p95,
    frameMax: motion.metrics.frameIntervals.max,
    longTasks: motion.metrics.longTasks.length,
    pageErrors: motion.errors.length,
    remainingAnimations: motion.rows.find((row) => row.interactionCycles)
      ?.remainingAnimations,
  });
}
await mkdir("artifacts/polish", { recursive: true });
await writeFile(
  "artifacts/polish/performance-summary.json",
  JSON.stringify(rows, null, 2),
);
const metrics = [
  ["Mean process-tree CPU", "cpuMean", "% of machine"],
  ["Busiest owned GPU engine peak", "gpuPeak", "% utilization"],
  ["Renderer interval p95", "frameP95", "ms · rAF scheduling"],
];
const panels = metrics
  .map(([name, key, unit]) => {
    const ceiling = Math.max(...rows.map((row) => row[key] ?? 0)) * 1.15;
    return `<section><h3>${name}</h3><p>${unit}</p><svg viewBox="0 0 300 150" role="img" aria-label="${name}: ${rows.map((row) => `${row.version}: ${row[key]?.toFixed(2)}`).join("; ")}">${rows
      .map((row, i) => {
        const y = 22 + i * 46;
        const shortVersion = row.version?.split(".").at(-1) ?? "baseline";
        return `<text x="0" y="${y + 14}">.${shortVersion}</text><rect x="32" y="${y}" width="${((row[key] ?? 0) / ceiling) * 190}" height="23" rx="4" style="fill:var(--chart-${i + 1})"/><text x="${40 + ((row[key] ?? 0) / ceiling) * 190}" y="${y + 16}">${row[key]?.toFixed(2) ?? "N/A"}</text>`;
      })
      .join("")}</svg></section>`;
  })
  .join("");
await writeFile(
  "artifacts/polish/performance.html",
  `<!doctype html><html><head><meta charset="utf-8"><style>
html,body,main{margin:0;background:transparent}body{color:var(--foreground);font-family:var(--font-sans)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:12px}section{padding:16px;border-radius:var(--radius);background:var(--card);border:1px solid var(--border)}
h3{font-size:14px;margin:0 0 5px}p{font-size:12px;color:var(--muted-foreground);margin:0}svg{display:block;width:100%;height:150px}text{fill:var(--foreground);font-size:16px;font-family:var(--font-mono)}.note{font-size:12px;line-height:1.5;margin-top:12px;color:var(--muted-foreground)}
</style></head><body><main><div class="grid">${panels}</div><p class="note">Installed Nightly · 120 rapid popup cycles per run · .2 baseline, .3 initial polish, .4 final polish where shown. Single runs, different automation durations; no statistical speedup claim. CPU includes owned WebView2 processes. GPU utilization is PDH sampling, not GPU frame time. rAF intervals are not presented frames.</p></main></body></html>`,
);
console.log(JSON.stringify(rows));
