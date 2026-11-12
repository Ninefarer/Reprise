# Context menu refinement

Local candidate work on develop. No version bump, commit, push, tag, release publication or installation is part of this pass.

## Shared menu

Task and sidebar context menus reuse PopupMenu and the existing taskActions definitions. The shared menu now supports consistent SVG glyphs, separators, disabled rows, shortcut labels, keyboard navigation, type-to-focus, cursor positioning and measured viewport clamping. Window resize, external scrolling and loss of window focus dismiss it. Opening another menu retires the previous owner. Request identity and exit-timer cleanup prevent a closing menu from dismissing a rapid reopening at the same location.

The HTML Popover API raises the menu into the webview top layer. Menus opened from a modal also portal into that modal so they remain interactive rather than inert. Older engines without Popover use the existing overlay fallback. Escape closes the menu without closing its parent task dialog or capture window. Actions execute immediately, with focus restored before invoking existing task commands; outside/Escape dismissal has a brief exit animation. Existing Animation Off and reduced-motion overrides suppress decorative motion.

Theme tokens supply neutral surfaces, selected states, text, focus and shadows. Task glyphs retain semantic state colors. Native Glass uses a near-opaque floating menu tint and a small internal backdrop filter; this is not a replacement for native desktop composition. High contrast and reduced-transparency settings use opaque fallbacks.

## Editing

TextContextMenus supplies Cut, Copy, Paste, Select All, and supported Undo/Redo for ordinary text/search/url/tel inputs and textareas. Read-only and empty selections disable incompatible actions. Password fields, specialized native controls and contenteditable regions retain WebView2's native menus. Selected noneditable text, links and images retain useful native menus; blank app chrome has no generic browser menu.

Clipboard access uses the official Tauri 2 clipboard-manager plugin, with only read-text and write-text permissions scoped to the existing main/capture windows. It is accessed only when a user chooses a clipboard action, never polled or logged on menu opening. The Rust and JavaScript plugin packages are the only new direct dependencies. Cargo's cross-platform lock additions are transitive; existing locked package versions are preserved.

The clicked field's range and value are captured before menu focus moves. Cut copies successfully before deleting. Paste and Cut restore the original range and use the browser editing engine rather than assigning value, preserving the browser's native undo buffer and React input events. Stale asynchronous reads do not modify a changed field or steal focus after the user moves elsewhere. Errors surface without silently losing the text. Ctrl+C/X/V/A/Z/Y remain native outside menus and activate the corresponding enabled action when a menu is open; Ctrl+Shift+Z also maps to Redo inside a menu.

The editing commands use document.execCommand for insertText/delete/undo/redo. This API is deprecated, but currently preserves the browser undo buffer where direct DOM assignments do not. It was verified in the Windows WebView2 QA build. Recheck after major WebView2 changes; unsupported commands report an error and retain keyboard/native fallback options rather than pretending success.

## Actual Windows checks

Used a separate com.reprise.context.qa profile and an owned task named QA context menu task. Real user tasks and installed processes were untouched.

- Cut removed the selected QA text; the menu's Undo restored it; native Ctrl+Y redid the cut.
- Paste inserted the known QA clipboard text into another input and a task-details textarea.
- The text menu remained above and clickable inside the native modal dialog.
- Saving task details retained the pasted notes. Start Now from the task menu persisted DoNow and refreshed sidebar counts. A read-only SQLite check confirmed both task status and notes.
- Inspected task and text menus in Classic dark, text menus in Classic light, and readability over native Clear Glass.
- Right-clicking another input while a menu was open retargeted correctly, with Paste modifying the new field.

Unit and integration coverage additionally checks disabled actions, read-only fields, clipboard failure, asynchronous focus changes, viewport geometry, simultaneous menu owners, rapid exit/reopen, modal host selection, keyboard actions, every existing task lifecycle view, and Quick Capture draft/focus preservation on menu Escape. No existing tests were removed or weakened.

Final checks: 155 frontend tests and 46 Rust tests passed. The explicit real-toast probe remained ignored by default; no new toast was required for this menu pass. TypeScript/Vite production build, Tauri Windows debug build, cargo check, strict all-target Clippy, Rust formatting and frontend formatting checks passed. The owned QA task/profile and temporary build config were cleaned up.

Physical trackpad gestures, the global Quick Capture shortcut with another installed channel running, a fresh Acrylic-specific appearance pass, and older WebView2 Popover fallback behavior were not manually exercised. The app's real lifecycle/scheduling/notification tests remain in place. Clipboard and task testing used only known QA text and data.

## Files

- PopupMenu.tsx, TaskMenu.tsx, Sidebar.tsx and menuIcons.tsx: shared menu behavior and presentation.
- TextContextMenu.tsx and context-menu.css: field editing and scoped styling.
- App.tsx: mount the same text-menu support for the main and capture windows.
- PopupMenu.test.tsx and App.test.tsx: focused regressions and existing workflow checks.
- package manifests/lockfiles, Rust plugin initialization and default capabilities: official native clipboard access.

References: [Tauri clipboard plugin](https://v2.tauri.app/plugin/clipboard/) and [browser editing/undo constraints](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand).
