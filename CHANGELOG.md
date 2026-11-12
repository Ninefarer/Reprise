# Reprise changelog

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
