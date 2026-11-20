// Native release inspection through a locally enabled WebView2 diagnostics port.
// Matrix mode exercises Reprise's own visual_preferences IPC, never modifies DOM
// styling, and restores the original visual preferences in finally.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const [mode = "inspect", label = "installed", port = "9228"] =
  process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label) || !/^\d+$/.test(port))
  throw Error("Invalid arguments");
const out = "artifacts/glass/transparency-regression";
const targets = await (
  await fetch(`http://127.0.0.1:${port}/json/list`)
).json();
const target = targets.find(
  (t) => t.type === "page" && t.url === "http://tauri.localhost/",
);
if (!target) throw Error("Expected a packaged Tauri main window, not Vite");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let id = 0;
const pending = new Map();
socket.onmessage = (e) => {
  const r = JSON.parse(e.data);
  if (r.id) {
    const p = pending.get(r.id);
    pending.delete(r.id);
    r.error ? p.reject(Error(JSON.stringify(r.error))) : p.resolve(r.result);
  }
};
const send = (method, params) =>
  new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const inspect = () =>
  evaluate(`(() => {
  const root=document.documentElement, s=getComputedStyle(root);
  const layers={};
  for(const selector of ['html','body','#root','.app','.content','.sidebar','.settings-section','.capture','.task-card','.control-popup']) {
    const el=document.querySelector(selector); if(!el) continue;
    const c=getComputedStyle(el); layers[selector]={background:c.backgroundColor,image:c.backgroundImage,opacity:c.opacity,filter:c.backdropFilter,color:c.color};
  }
  return {url:location.href,dialogs:document.querySelectorAll('dialog[open]').length,dataset:{family:root.dataset.family,theme:root.dataset.theme,mode:root.dataset.desktopGlass,variant:root.dataset.glassVariant,error:root.dataset.desktopGlassError,active:root.dataset.windowActive,effects:root.dataset.effects},tokens:Object.fromEntries(['--desktop-tint','--surface-rgb','--glass-pane-alpha','--glass-nav-alpha','--glass-content-alpha','--material-coverage'].map(n=>[n,s.getPropertyValue(n).trim()])),policies:{forcedColors:matchMedia('(forced-colors: active)').matches,reducedTransparency:matchMedia('(prefers-reduced-transparency: reduce)').matches,increasedContrast:matchMedia('(prefers-contrast: more)').matches},layers};
})()`);
const patch = (p) =>
  evaluate(
    `window.__TAURI_INTERNALS__.invoke('visual_preferences',{patch:${JSON.stringify(p)}})`,
  );
const original = JSON.parse(
  await readFile(`${out}/installed-original-visuals.json`, "utf8"),
);
const rows = [];
try {
  if (mode === "quit") {
    await evaluate("void window.__TAURI_INTERNALS__.invoke('quit_app'); true");
  } else if (mode === "matrix") {
    if ((await inspect()).dialogs)
      throw Error("Dismiss native app dialogs before measuring materials");
    for (const [family, theme] of [
      ["classic", "light"],
      ["classic", "dark"],
      ["peach", "light"],
      ["peach", "dark"],
      ["pitch-black", "dark"],
      ["ashen-white", "light"],
    ]) {
      for (const material of ["clear", "acrylic"])
        for (const tint of [35, 60, 78, 90]) {
          await patch({
            theme_family: family,
            theme,
            desktop_material: material,
            desktop_tint: tint,
            desktop_glass: true,
          });
          let state;
          for (let n = 0; n < 160; n++) {
            state = await inspect();
            if (
              state.dataset.family === family &&
              state.dataset.theme === theme &&
              state.dataset.mode === material &&
              Number(state.tokens["--desktop-tint"]) === tint / 100
            )
              break;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          if (
            state.dataset.family !== family ||
            state.dataset.mode !== material ||
            Number(state.tokens["--desktop-tint"]) !== tint / 100
          )
            throw Error("Native material did not settle");
          // Allow actual packaged WebView/DWM presentation between cases, rather
          // than recording only a synchronously updated root token.
          await new Promise((resolve) => setTimeout(resolve, 100));
          state = await inspect();
          if (state.dialogs || state.dataset.active !== "true")
            throw Error(
              "Matrix requires an active, unobscured installed window",
            );
          rows.push({ requested: { family, theme, material, tint }, ...state });
        }
    }
  } else rows.push(await inspect());
} finally {
  if (mode === "matrix") {
    await patch(original);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await mkdir(out, { recursive: true });
  await writeFile(
    `${out}/${label}.json`,
    JSON.stringify(
      {
        mode,
        rows,
        restored: mode === "matrix",
        target: "packaged http://tauri.localhost, not development",
      },
      null,
      2,
    ),
  );
  socket.close();
}
console.log(
  JSON.stringify({
    label,
    cases: rows.length,
    first: rows[0],
    last: rows.at(-1),
  }),
);
