# Performance baseline, November 12, 2026

This is development work after the 3.3.3 releases, not a performance claim for either installer.

## Reproduce

```powershell
cargo test --release --manifest-path src-tauri/Cargo.toml performance_baseline::snapshot_path_baseline -- --ignored --nocapture
```

The opt-in Rust test uses the real `Store::tasks`, `Store::settings` and `Store::notices` methods and the current JSON construction path. Each case has two warm-up runs and 15 measured runs. Data is synthetic, held in an isolated in-memory SQLite connection, and discarded when the test exits. Each task has 376 characters of synthetic description; each notification has 100 characters of synthetic message. No real profile, database, notification submission or scheduler is touched.

Release-mode results from this Windows x64 development session:

| Tasks | Notices | JSON bytes | Task query/decode median | Notice query median | JSON value median | Encoding median | Total median | Total p95 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0 | 78,649 | 0.303 ms | 0.012 ms | 0.231 ms | 0.079 ms | 0.635 ms | 0.687 ms |
| 1,000 | 1,000 | 1,130,638 | 2.553 ms | 0.930 ms | 3.522 ms | 1.539 ms | 8.485 ms | 9.085 ms |
| 10,000 | 10,000 | 11,318,638 | 35.738 ms | 8.984 ms | 36.116 ms | 14.757 ms | 95.477 ms | 98.962 ms |

Medians of individual phases need not sum to the median total. The total includes settings reads, assertions and allocation/drop overhead. The test has correctness assertions, not machine-dependent timing thresholds.

## Interpretation and limits

The existing backend path has measurable scaling cost, including constructing and encoding data that may be unchanged. This does not establish a present responsiveness defect in ordinary personal profiles. It does justify measuring redundant snapshots before attempting broad UI optimization.

These are backend microbenchmarks, not startup, IPC, WebView decoding, React rendering, input latency or idle-power measurements. In-memory SQLite excludes persistent storage cost. Avatar loading, Windows appearance queries and mutex contention are excluded. The machine was in an ordinary interactive session; results are not from a controlled benchmark host. Fifteen samples give only a rough p95. No speedup is claimed.

## Ranked next investigations

1. **Unchanged refreshes.** Measure actual snapshot frequency and bytes in visible and hidden windows using the existing opt-in trace. The frontend has a 15-second fallback poll and the worker emits refresh every tick. Concurrent calls already coalesce. Consider avoiding unchanged notifications or repeated snapshots while preserving authoritative scheduler ticks and recovery after focus.
2. **Database lock duration.** Snapshot currently retains the database guard while building the JSON value and loading profile/system presentation data. Measure contention and evaluate releasing it after the coherent database reads. Any change must preserve one consistent database read and prove task writes/scheduler work are not blocked by presentation packing.
3. **Large-list UI work.** Record search and render latency with disposable representative profiles before changing memoization, filtering or list rendering. The backend measurements cannot justify virtualization on their own.

The agreed process remains measurement, ranked review, then behavior changes. This commit adds the reproducible measurement only; refresh frequency, lifecycle semantics and scheduling are unchanged.

Actual visible/hidden/minimized window observations are now recorded in [the refresh activity investigation](qa/refresh-activity-2026-11-12.md), with a native-window-aware suspension proposed for review.

The approved first optimization and its before/after measurements are recorded in [native-window refresh suspension](qa/window-refresh-suspension-2026-11-13.md). That follow-up preserves the independent Rust engine, makes Capture bootstrap lightweight and documents the remaining manual acceptance gaps.
