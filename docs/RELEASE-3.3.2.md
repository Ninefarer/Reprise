# Stable 3.3.2 build record

Scope: signed updater bootstrap on top of Stable 3.3.1. Nightly Settings draft protection, copy changes, diagnostics changes and performance instrumentation are deliberately excluded.

Local checks: 163 frontend tests, 48 Rust tests, TypeScript and Vite production build passed. The release workflow repeats the suites, formatting and strict Clippy before signing. The existing signed QA artifact checks passed both tests without skips.

The actual installed signed upgrade and rejection cases are recorded in [updater-acceptance.json](updater-acceptance.json). QA used a separate identity and synthetic data, with loopback HTTP enabled only by an explicit QA Cargo feature. Production uses HTTPS and the normal identities. GitHub distribution URLs and downloaded artifacts must be checked after publication.

Existing users install this first updater-enabled installer manually once, over the matching channel, without deleting data. Updater signatures authenticate update artifacts; they are not Windows Authenticode certificates or a claim that SmartScreen warnings are absent.

## Published distribution check

The signed workflow [43327134809](https://github.com/Ninefarer/Reprise/actions/runs/43327134809) passed and published `v3.3.2`. An unauthenticated HTTPS fetch of the Latest manifest resolved to 3.3.2. Its installer and sidecars downloaded successfully; the public key verified the artifact and signed version. The checksum and GitHub asset digest matched `76d1cac4e7cd59454961117dcc67624256a06dd546c298a7774891e5db042925` (4,554,627 bytes). Stable remained Latest. The release is immutable; this record does not modify its published source.
