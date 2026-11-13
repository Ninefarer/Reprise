# Window-state refresh measurements

Measured November 12, 2026 on Windows x64, using release-mode builds and an isolated `com.reprise.performance.qa` profile. The profile contained 100 synthetic Inbox tasks and 100 synthetic notification records. Classic dark, opaque appearance was used. No real task database or installed application was changed.

## Observed

Each observation used the first complete 90-second interval after its state marker. Startup, focus events and transitions were excluded. The analyzer checked the native visibility/minimized flags for every included sample.

| Main window | Quick Capture | Main snapshots | Capture snapshots | Combined snapshots/minute |
| --- | --- | ---: | ---: | ---: |
| Visible | Hidden | 12 | 12 | 16 |
| Hidden to tray | Hidden | 12 | 12 | 16 |
| Minimized | Hidden | 12 | 12 | 16 |
| Hidden to tray | Visible | 12 | 12 | 16 |

Every window completed six timer-triggered and six worker-event-triggered snapshots in each interval. The existing concurrent-request guard did not merge those steady-state requests in these observations. This does not establish how it behaves under slow or overlapping requests.

Each full snapshot contained about 116 kB of logical JSON for this profile. Across both webviews, that is about 1.85 MB/minute of repeated local snapshot data. These are serialized data sizes, not measured network traffic or IPC framing bytes. Backend median durations ranged from 0.849 to 1.083 ms across the window/state groups; this small profile does not establish a large CPU or battery problem. WebView decoding, React rendering and total process CPU were not measured.

The hidden native main window still reported browser `document.visibilityState` as `visible` during the open-capture case. A subsequent both-hidden observation also recorded `visible` for both webviews while their native visibility flags were false. Browser visibility alone is therefore insufficient for the proposed suspension on this system. A minimized native main window reported `is_visible = true` and `is_minimized = true`; checking only `is_visible` would also miss that state.

The task, notification, event and history rows had the same SHA-256 before and after measurement: `3cc6f9b87f9dd7a271eedbe57136894c413ec156079791c76113f2fd96740d0d`. SQLite integrity was `ok`. The QA process was stopped afterward. No tasks were created through the UI or notifications submitted to Windows.

## Instrumentation and reproduction

The optional `performance-qa` Cargo feature adds a metadata recorder only for the exact QA identity and explicitly measured snapshot calls (`?perf=1`). It writes counts, numeric timings, whitelisted request reasons and window states to that QA profile's `performance-qa.jsonl`. Task text, profile names, paths and notification content are not exported. Standard builds do not compile the recorder. Ordinary launches still invoke the existing unmeasured snapshot path.

Two release-mode QA builds were used: the initial recorder collected native states; the second added browser visibility metadata and a QA-only capture shortcut. Snapshot refresh and scheduling behavior were unchanged between builds. The shortcut is `Ctrl+Alt+Shift+Space` only for this feature and identity, allowing installed Stable/Nightly instances to keep their usual shortcut. A first attempt with the normal shortcut opened installed Stable Capture; it was hidden again without entering or saving anything.

Use an app configuration with the isolated identity, `index.html?perf=1` for main and `index.html?capture=1&perf=1` for capture. Generate synthetic data using the existing Store schema; do not copy a real user's database. Disable native notification submission and daily review in that test profile. Build with:

```powershell
npm run tauri -- build --features performance-qa --no-bundle --config artifacts/performance-qa/config.json
```

Operate actual windows with Computer Use. Record UTC millisecond state markers, observe each state for at least 90 seconds, then analyze the metadata:

```powershell
python scripts/performance/summarize.py artifacts/performance-qa/raw.jsonl artifacts/performance-qa/markers.json docs/qa/refresh-activity-2026-11-12.json
```

The analyzer rejects incomplete observations, native-state changes during a sample, missing windows and changes in profile size. Raw logs and markers remain ignored QA artifacts; the [aggregate record](refresh-activity-2026-11-12.json) contains no task content.

## Recommended next change for review

Suspend full frontend snapshot requests for native-hidden or minimized windows. Preserve the initial snapshot needed to initialize each webview, and catch up task data, countdown time and appearance when returning to a window. Keep Rust scheduling, native notification delivery, database writes and automatic-update behavior independent of this presentation optimization. Verify capture focus/save, resumed task routes and surfaced reminders after hidden periods.

This should remove avoidable hidden-window fetches. It is a proposal, not an implemented speedup. Worker refresh deduplication and database-lock duration remain subsequent candidates. No refresh timers, lifecycle semantics or reminder schedules were changed by this investigation.

## Checks

- Frontend: 172 tests passed; TypeScript and Vite production build passed.
- Normal Rust build: 49 tests passed; the manual benchmark and real-toast probe were intentionally ignored.
- `performance-qa` build: 50 tests passed, including the metadata privacy/whitelist and channel shortcut checks; the same two manual probes were ignored.
- Rust formatting and strict Clippy passed with and without the QA feature.
- The analyzer validated four complete observation intervals against native states and fixed profile counts. Task/notice/event/history hashes matched before and after; SQLite integrity passed.

The recorder adds measurement overhead (metadata queries, serialization for size, and a small log write). Reported backend phases are sampled before that extra work. These results do not quantify total idle CPU, battery usage, or long-session behavior, and do not claim an optimization has shipped.
