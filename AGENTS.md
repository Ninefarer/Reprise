# Reprise project instructions

Develop on `develop`; do not merge into `main` without authorization. Preserve existing user data, native Windows glass, task lifecycle and notification scheduling. Do not publish, tag, push or alter existing releases without explicit authorization.

For GitHub release descriptions, use the `reprise-release-manager` skill and follow [docs/RELEASING.md](docs/RELEASING.md). The repository Stable conventions explicitly supersede the skill's older symbol-prefixed bullet convention: use the supplied pixel-art banners with ordinary Markdown bullets. Stable notes must not include Implementation, Validation or Known Limitations sections, test counts, CI reports or architecture details. Nightly notes retain technical detail. Never invent personal messages for ...HEY.

GitHub presentation templates and artwork are independent of the in-app changelog. Do not import repository presentation assets into Vite or Tauri resources. Never regenerate or modify official artwork without permission.
