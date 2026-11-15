# Stable 3.4.0 preparation record

The owner approved Stable promotion after evaluating `3.4.0-nightly.20261113.1`. This brings the UI overhaul and native-window refresh work to Stable without changing the separate channel identities, feeds, signing key, database schema or Rust scheduler.

Before promotion, removed three requested Settings explanations from Appearance and the idle shortcut recorder. Recording instructions and validation errors remain, and the input references its feedback region only while that region exists. Updated the repository changelog, bundled release content and Stable GitHub notes. The personal note is owner-supplied; the original four release banners are unchanged and pinned to their immutable artwork commit.

One existing notification test failed because it waited for the mocked persistence mutation rather than the rendered unpinned state before pressing Escape. Its synchronization now waits for the visible Pin notifications button; the original dismissal assertion is retained. No notification behavior was changed for this test correction.

Release checks include the full frontend/Rust suites, TypeScript/Vite build, reporting/updater Node checks, formatting and strict Clippy. GitHub Markdown rendered all four banner images and the supplied strikethrough note. Anonymous HTTPS image downloads matched the exact repository artwork bytes. The signed Windows workflow reruns checks and verifies the produced installer before publication; post-publication verification checks the tag, assets, signature and both channel feeds.

Native acceptance from the Nightly pass is recorded in [the UI/UX acceptance report](qa/uiux-3.4.0.md) and [window refresh measurements](qa/window-refresh-suspension-2026-11-13.md). The owner supplied final visual approval. The removed explanatory copy does not change native window effects or preferences. Broader DPI/accessibility combinations, physical sleep/resume, actual toast display/activation and a freshly installed upgrade of this exact Stable candidate were not rerun. The installed-upgrade acceptance fingerprint remains unchanged from the previously verified signing/backend/channel path; no gate is weakened or replaced.

GitHub Stable notes use the repository's banner/plain-bullet conventions, with no implementation, validation or limitations sections. Engineering evidence remains here rather than in those user-facing notes.
