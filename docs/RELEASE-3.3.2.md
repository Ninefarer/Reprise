# Stable 3.3.2 build record

Scope: signed updater bootstrap on top of Stable 3.3.1. Nightly Settings draft protection, copy changes, diagnostics changes and performance instrumentation are deliberately excluded.

Local checks: 163 frontend tests, 48 Rust tests, TypeScript and Vite production build passed. The release workflow repeats the suites, formatting and strict Clippy before signing. The existing signed QA artifact checks passed both tests without skips.

The actual installed signed upgrade and rejection cases are recorded in [updater-acceptance.json](updater-acceptance.json). QA used a separate identity and synthetic data, with loopback HTTP enabled only by an explicit QA Cargo feature. Production uses HTTPS and the normal identities. GitHub distribution URLs and downloaded artifacts must be checked after publication.

Existing users install this first updater-enabled installer manually once, over the matching channel, without deleting data. Updater signatures authenticate update artifacts; they are not Windows Authenticode certificates or a claim that SmartScreen warnings are absent.
