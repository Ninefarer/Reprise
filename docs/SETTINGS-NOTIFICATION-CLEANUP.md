# Settings, notifications and release-writing cleanup

Local implementation on develop; no version bump, commit, push, tag, installer distribution or release publication performed.

## Confirmed notification defect

An opt-in native Windows probe using the installed com.reprise.nightly identity reproduced HRESULT 0x80070490 specifically at ToastNotifier.Setting(), before Show. The shortcut and Start entry already matched that identity. Treating only the missing-record error as unknown permission allows Show to ask Windows to submit. Explicit disabled states still block; other query failures propagate with stage/identity context. No Windows setting is modified and no fallback identity is used. The same native preparation path is used by the application and the opt-in probe.

The probe subsequently passed and the user confirmed seeing a Nightly notification banner. This verifies that specific test's visible delivery, not a universal display guarantee. Windows remains responsible for Focus/DND and notification permissions. Diagnostics now describes an absent permission record accurately instead of advising installation as though a shortcut were necessarily missing.

## UI changes

Nightly's test action moved into Advanced / Diagnostics; the rest of Attention and background behavior remains unchanged. Stable hides the diagnostics section and test action. Nightly Settings omits the manual What's New button, preserving its post-setup disclosure and history. Nightly's version picker excludes Stable entries. No GitHub artwork is imported into the in-app release UI.

Setup has a dedicated 300 ms entrance and 140 ms outgoing fade with guarded step changes and timer cleanup. Existing Animation Off, reduced-motion and hidden-window handling remain respected. Preferences, scheduling and task storage formats are unchanged.

## Checks

139 frontend tests passed. 46 Rust tests passed; one real-toast integration probe is ignored by default and was separately executed successfully using REPRISE_TOAST_TEST_ID=com.reprise.nightly. TypeScript/Vite production build, cargo check, strict Clippy across all targets, Rust formatting and Prettier checks passed. Strict Clippy initially flagged three pre-existing test-style warnings; equivalent struct initialization and borrowed single-item slices fixed them without weakening assertions.

A debug Tauri Windows build passed with a separate com.reprise.settings.qa profile. Computer Use confirmed the unchanged Attention section, relocated test action within Advanced, absence of Nightly's What's New button, the Nightly-only version dropdown, and setup moving through its outgoing fade to the next usable step. Stable diagnostics visibility and channel filtering have frontend regression coverage. Repository release artwork remains outside dist and Tauri resource rules. Live GitHub banner URLs cannot be verified until an explicitly authorized asset push; no external hosting or visibility change was made.
