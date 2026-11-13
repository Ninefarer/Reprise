# Getting started

[Documentation](README.md) · [Task workflow](TASK-WORKFLOW.md)

## Install

Reprise targets Windows 11 on x64 PCs. Download the `.exe` setup file from the [latest Stable release](https://github.com/Ninefarer/Reprise/releases/latest), run it, then open Reprise. The adjacent `.sha256` file is available if you want to verify your download. No development tools are needed.

## Make it yours

In the 3.4.0 development candidate, setup offers a display name, avatar, appearance and reminder preferences. You can skip setup and change preferences later. Settings opens from your profile at the bottom of the sidebar. Earlier published builds may also show Space name.

Stable and Nightly can have different setup screens. Consult the notes for the version you installed.

## Capture something

Type into Home's quick-add field and choose **Add to Inbox**. You can also press **Ctrl+Shift+Space** to open Quick Capture, type a title, and press Enter. Escape hides that window without saving the draft.

Inbox is a place to capture first and organize later. When you're ready, choose Start Now, schedule a start, or pause the task. [Task workflow](TASK-WORKFLOW.md) explains the choices.

The command palette opens with **Ctrl+K** by default. The 3.4.0 candidate lets you record a custom combination in **Settings > Keyboard**; earlier builds offer Ctrl+K or Ctrl+Shift+P. Quick Capture uses the fixed Ctrl+Shift+Space shortcut; another app using it can prevent registration.

In 3.4.0, Settings has Profile, Appearance, Reminders, Keyboard and About tabs. Save or discard drafted changes in each section. Appearance and avatar changes save immediately. Leaving Settings with unsaved drafts offers Save, Discard or Keep editing.

## Keep reminders running

With close-to-tray enabled, closing the main window leaves Reprise running. Use its tray menu to reopen it or quit completely. **Quit Reprise** stops background reminders until you launch it again. On launch, overdue return events are reconciled.

Windows notification permissions, Focus / Do Not Disturb, and Reprise's quiet hours can affect reminders. Reprise's notification panel keeps its own history; clearing that history does not clear Windows Notification Center. A submitted notification is not proof that Windows displayed a banner.

## Updates

Install Stable 3.3.2 manually once to enable signed in-app updates. Run the matching installer over the existing installation. After setup, Reprise checks for updates automatically; you can also use **Settings > About / Updates > Check for updates**. An available update appears in Notifications. Click its title when you want to install, or leave it for later. Stable updates stay on Stable; Nightly updates stay on Nightly.

Older builds still require a manual download from the appropriate release channel.

Task data is kept separately from the installed application. Do not delete the application data directory when updating. For feed configuration and technical details, see [Updater integration](UPDATES.md).

## Try Nightly separately

[Nightly releases](https://github.com/Ninefarer/Reprise/releases?q=nightly&expanded=true) are marked Pre-release and contain development changes for testing. Read the notes for the exact build before installing.

Nightly has its own installation and local database. It does not automatically import Stable tasks. Quit one channel before testing Quick Capture in the other because both register Ctrl+Shift+Space.

To report a problem, include your version, whether you're using Stable or Nightly, and the steps to reproduce it in [GitHub issues](https://github.com/Ninefarer/Reprise/issues). Avoid sharing private task content.
