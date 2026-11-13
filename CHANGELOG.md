# Reprise changelog

## 3.4.0 / 3.4.0-nightly.20261113.1 - Development candidate, not published

- Combine the existing hidden/minimized refresh suspension and lightweight Quick Capture work with the Issue #2 UI overhaul.
- Rename navigation to Hub, Ongoing and Archive, and display Do Now as Current without migrating task states.
- Add custom selection and date/time controls, inline capture validation and configurable command palette shortcuts.
- Reorganize Settings into tabs with atomic section saves; simplify task editing and collapse destination-colored history.
- Simplify notifications and repeated copy, remove Space name from the UI, standardize Avatar terminology, and refine Compact spacing, tooltips and greetings.
- Keep release history within its installed channel.
- Native Windows acceptance and signed installer evaluation remain pending. See [3.4.0 verification](docs/qa/uiux-3.4.0.md).

## 3.3.3 - November 12, 2026 - Hotfix

### Fixed

- Unsaved Settings drafts now prompt Save, Discard, or Keep editing before navigation, replaying setup, quitting from the profile menu, or installing an update. Failed saves keep the draft and pending action open.
- Settings show a sticky save bar and distinguish immediately saved appearance and picture changes from profile and reminder drafts.
- Saved tasks and persisted preferences were unaffected by the original issue. Updater signing, channels, task lifecycle and reminder schedules remain unchanged.

## 3.3.3-nightly.20261112.1 - November 12, 2026

- Guard unsaved profile and reminder drafts before navigation, setup replay, profile-menu Quit and update installation; preserve failed saves and distinguish immediately saved appearance changes.
- Include the task-editor data-loss hotfix and signed, channel-specific updater bootstrap.
- Handle missing Windows notification permission records without treating them as an explicit block.
- Keep diagnostic notification testing and technical history controls coherent on Nightly.
- Improve current interface copy, task-dialog names and command-palette announcements.
- Add bounded, explicitly enabled performance tracing for subsequent measurement, without claiming a speedup.


## 3.3.2 - November 12, 2026

### Added

- Signed in-app updates distributed through GitHub Releases, with separate Stable and Nightly feeds.
- Automatic checks after setup and every six hours, plus an explicit check in Settings. Users choose when to install from the update notification.
- Signature and signed-version validation, channel isolation, stale-offer rechecking and recovery after interrupted updates.
- GitHub Actions signing with repository secrets and a publication gate backed by an installed-upgrade test.

### Updating

- Existing installations need this updater-enabled installer manually once. Install over the matching channel without uninstalling or deleting its data.
- No task lifecycle, reminder schedule, application identity or database schema changes.


## 3.3.1 · November 12, 2026

### Fixed

- Task-detail actions **Do now**, **Settle**, and **Finish** now save the current edited title, notes, dates, project, and other fields with the status transition. Previously, those buttons submitted the original task and could silently discard unsaved edits.

Existing revision checks, task history, and Undo remain in place. Regression coverage also verifies that rejected updates retain the open draft.

## 3.3.0 · November 12, 2026

This is the complete Stable change record since 3.2.0, bringing the selected Nightly work into Stable. Historical Nightly entries remain available in the application's release history and on [GitHub](https://github.com/Ninefarer/Reprise/releases).

### Added

- Dedicated three-step onboarding for profile and appearance, return and reminder preferences, and an optional first Inbox task.
- A confirmed **Redo onboarding** action in Settings that preserves existing tasks, history, and profile data.
- Shared application-styled right-click editing menus for ordinary text inputs and textareas, including task details and Quick Capture.
- Working Cut, Copy, Paste, Select All, Undo, and Redo actions, with shortcut hints and native clipboard access.
- Original Stable and Nightly application icons, with channel-specific Windows executable, window, tray, installer, and uninstaller resources.
- A wordmark-led repository README with the supplied Stable screenshot and clear installation, channel, documentation, and issue links.
- User guides for installation, task lifecycle, and returning tasks; developer documentation for building, architecture, native icons, and context menus.
- Stable GitHub release templates using the original Additions, Changes, Bugfixes, and optional ...HEY artwork. Nightly keeps technical release notes.

### Changed

- Task, sidebar, and editing context menus use one presentation system with consistent SVG icons, separators, disabled states, and shortcut labels.
- Menus support Arrow keys, Home, End, type-to-focus, Escape, and existing editing shortcuts, with focus restored on dismissal.
- Menus position near the pointer, clamp to the visible window, scroll when necessary, and dismiss on outside interaction, external scrolling, resize, or window blur.
- Light, dark, and native Glass menus share theme tokens, restrained animation, readable floating surfaces, and reduced-motion/high-contrast fallbacks.
- Stable onboarding follows the chosen application theme. The static blue-violet star field, sidebar Nightly marker, and testing disclosure remain Nightly-only.
- Onboarding now uses a short outgoing transition and a gentler arrival, while Animation Off and reduced motion skip decorative movement.
- Navigation, notification edge reveal, and commands stay out of the way during initial setup and replay; queued task routes wait until setup completes.
- Nightly's disclosure follows onboarding instead of interrupting it.
- Tray icons use the configured channel artwork instead of a generated square.
- Stable GitHub descriptions focus on visible changes; technical build records remain in engineering documentation.

### Fixed

- Context menus opened from task dialogs remain interactive above the dialog rather than behind it or in an inert background.
- Closing a menu with Escape does not also close the task dialog or Quick Capture, and preserves the capture draft.
- Rapid menu reopening cancels the previous close timer, including repeated right-clicks at the same coordinates.
- Only one context menu owns the interaction at a time; right-clicking another field targets that field and its selection.
- Cut removes text only after clipboard writing succeeds. Delayed Paste is cancelled when the field, value, focus, or menu request changes.
- Editing preserves browser undo history where WebView2 supports the editing command. Password and specialized native controls retain their existing editing behavior.
- Setup no longer embeds Settings or displays a misleading disabled update-check control.
- Retrying a failed setup save does not create the optional first task twice.
- Native reminder activation queues behind an open editor, refreshes task data before navigation, and ignores deleted tasks.
- Finishing or rescheduling cancels obsolete queued start/deadline reminders, including quiet-hours reminders.
- Undo restores the exact pending reminders cancelled by its transition, without reviving dismissed or submitted history.

### Compatibility

- Existing Stable task storage, scheduling, native Clear Glass and Acrylic, preferences, and application identity are retained.
- Nightly remains a separate installation and local database; installing Stable does not import or erase Nightly data.
- GitHub release banners, full-size branding sources, and README screenshots remain repository assets, outside the Windows runtime bundle.
- GitHub downloads remain manual; this release does not connect a signed automatic-update feed.

## Earlier releases

See [GitHub releases](https://github.com/Ninefarer/Reprise/releases) and Settings → Release Notes history for the existing 3.2.0, 3.1.x, and early release records. Their notes are preserved rather than rewritten as part of 3.3.0.
