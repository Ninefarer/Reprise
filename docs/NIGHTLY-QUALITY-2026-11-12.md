# Nightly quality pass, November 12, 2026

## Confirmed changes

The task editor submitted the original task from its Do now, Settle and Finish buttons, discarding unsaved fields. Stable 3.3.1 fixes this with draft-based submission, revision checks and failure retention; Nightly includes the fix.

Settings formerly let users leave edited profile/reminder fields without a warning. The editor now tracks those fields against its saved baseline and shares one Save/Discard/Keep editing guard across app navigation, setup replay and profile-menu Quit and update installation. Immediately persisted appearance/pictures do not become pending edits. Failed saves retain the editor and prompt. Native tray Quit and OS shutdown are unchanged.

Task dialogs now have accessible names; the command palette announces result counts. User-facing copy is shorter and current public-repository guides no longer claim repository access is required. Historical release text and the owner's personal message were preserved.

Windows notification registration's missing-record HRESULT is distinct from an explicit permission block. Test submission is available in Nightly Advanced / Diagnostics. A successful API submission is still not presented as proof of a visible banner. The real-toast test is opt-in.

## Actual desktop observations

The Actions-signed QA installation uses its own identity and synthetic profile/task. It upgraded and restarted from `.900` to `.901`. The task editor exposed the dialog name **Edit task**, with the saved title and notes intact. Editing the synthetic profile and selecting Home showed the navigation guard. Keep editing retained the draft; Discard returned Home with the saved profile. Sidebar zero counts remained absent and the pinned notification panel remained readable in Classic opaque mode.

Installed-updater success and failure cases, source and artifact hashes are in [the acceptance receipt](updater-acceptance.json). Production HTTPS distribution was independently verified after Stable publication; see [3.3.2 build record](RELEASE-3.3.2.md).

## Performance findings and limits

Source inspection confirmed full-snapshot polling from the frontend and scheduler refresh events every 15 seconds. The frontend already coalesces concurrent requests. Queries load/decode all tasks and notification history under the shared database mutex; rendering maps all matching cards. These are costs worth measuring, not established bottlenecks.

A previous brief process sample and synthetic in-memory SQLite query runs do not establish real input latency, idle efficiency or a memory leak. No refresh-frequency, scheduling or list-virtualization change was made. No application speedup is claimed.

Explicit per-window `?perf=1` instrumentation now stores at most 256 local in-memory samples: snapshot reason/counts/serialized size, optional database phase timings, UI commits and capture-save latency. Default launches collect nothing; samples contain no task text and are not persisted or transmitted. Follow-up work should establish cold/warm startup, capture/search latency and hidden/visible idle behavior with disposable representative profiles before choosing optimizations.

## Checks

Final local frontend suite: 172 passed. Rust suite: 49 passed, one opt-in real-toast probe ignored. TypeScript/Vite build, Rust formatting, strict Clippy and both signed-artifact verifier checks passed. The release workflow repeats the final checks before signing and publishing.

Not freshly qualified: physical trackpad gestures, multi-monitor DPI, the complete theme/accessibility matrix, native Glass composition over changing backgrounds and long-session performance. These are QA gaps, not confirmed regressions. Existing native composition and task lifecycle code were preserved.
