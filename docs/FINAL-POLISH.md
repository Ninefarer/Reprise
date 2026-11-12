# Final visual polish

## Changes

- Pitch Black uses neutral near-black and gray surfaces, borders, secondary text and floating-surface edges. Ashen White uses neutral near-white surfaces, readable labels/placeholders and stronger input boundaries.
- Five curated interactive accents are centralized in `src/accents.css`: Lavender, Sage, Icy Blue, Rose and Neutral. Theme default resolves to Sage for Classic and Neutral for the fixed families. Explicit selections survive family changes. The lifecycle palette remains independent in `task-colors.css`.
- Accent and animation settings use validated patches to the existing SQLite Settings record; no task schema changes. Ordinary profile preference saves preserve the latest visual preferences.
- Finite motion tokens cover menus/popovers, native HTML dialogs and their backdrops, sidebar width/groups, notification panel and Undo toast. Menus measure untransformed bounds before being placed near edges. Resizing disables width interpolation while dragging. Collapsed groups become inert immediately, with their visual height transitioning independently.
- Off disables decorative animations/transitions. Windows UISettings.AnimationsEnabled and CSS reduced-motion preferences suppress motion without replacing the saved preference. Background/inactive windows pause finite animations. Nothing loops or writes to SQLite to drive animation frames.
- Successful completion persists immediately, then retains a noninteractive checkmark row for 220–240ms before removing it from the view. Failed writes do not create feedback. Animation Off skips retention. Newly changed review membership gets a single short teal highlight; ordinary refreshes and initial history loading do not replay it. Review state and task lifecycle are untouched.
- Removed decorative page eyebrows and remaining Opening/Open workspace copy. Personal profile and saved space fields remain intact. Settings stays in the profile menu; Notifications stays in the right panel. The obsolete App group is not reintroduced.
- Flat, Frosted and opt-in Glass retain their existing coverage and accessibility fallbacks. Main content, task lists and persistent sidebars remain opaque. Native OS select/date pickers retain native behavior.

## Files

Frontend: `accents.css`, `motion.css`, shared family tokens in `visual-system.css`, `AppearanceSettings`, `theme`, `visuals`, model types, App feedback, Sidebar group wrappers and PopupMenu placement. Existing structured release notes include the finishing changes.

Rust: Settings defaults, validated visual patches, preserved preference fields and Windows animation-preference reporting. Task commands, migrations, timers, notifications and deletion logic are unchanged.

## Automated verification

- 101 frontend tests pass, including semantic/accent contrast, neutral family foundations, secondary text, placeholders and input-boundary contrast; immediate persisted completion before visual removal; no feedback with Animation Off; review highlight deduplication; saved preferences and Windows suppression.
- 28 Rust tests pass, including persisted accent/motion choices and invalid-value rejection, plus existing task lifecycle, wake, migration, notification deduplication and deletion tests.
- TypeScript/Vite build and Rust check pass. Windows executable builds are verified during delivery.

## Platform limits

Native Windows select/date popups do not use app CSS entrance animations. Immediate menu/dialog dismissal avoids deferring focus restoration or clicks. The Undo toast fades at its existing automatic timeout; explicit dismissal remains immediate. Main-window backgrounds never acquire desktop blur.

Live Windows reduced-motion preference is also checked through existing snapshot refreshes; CSS media-query suppression responds directly. Installed notification activation remains an earlier implementation limitation, outside this visual pass.
