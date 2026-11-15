# Avatar crop hotfix verification

Implementation: 7b6938593a9280ee4d99a42008fad7b3336a552e.

- 206 frontend tests passed; production frontend build passed.
- 53 Rust tests passed, with 2 existing manual tests ignored. Rust formatting and strict Clippy passed.
- Native Windows WebView QA used com.reprise.avatar.qa.20261115 and a generated 800x400 striped image. Stable and Nightly profiles were not used for the test.
- Observed: circular 256px preview, horizontal drag following the mouse, button zoom from 100% to 110%, wheel zoom to 120%, and Save showing the expected crop in the avatar.
- Automated: crop bounds at both edges, no movement on a full-size axis, pointer capture loss, cancellation without save, keyboard movement, zoom limits, reset and save-failure retention.
- Not manually exercised: touch, additional Windows display scaling settings, and this hotfix's installed upgrade. Existing updater acceptance remains applicable because updater code, key and channel identities/endpoints are unchanged.
