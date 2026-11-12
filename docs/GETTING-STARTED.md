# Getting started

[Documentation](README.md) · [Task workflow](TASK-WORKFLOW.md)

## Install

Reprise targets Windows 11 on x64 PCs. Download the `.exe` setup file from the [latest Stable release](https://github.com/Ninefarer/Reprise/releases/latest), run it, then open Reprise. The adjacent `.sha256` file is available if you want to verify your download. No development tools are needed.

The repository is currently private. You need repository access to view releases, download installers, or report issues.

## Make it yours

Follow setup to choose a display name, an optional space name, appearance, and reminder preferences. You can skip setup and change preferences later. Settings opens from your profile at the bottom of the sidebar.

Stable and Nightly can have different setup screens. Consult the notes for the version you installed.

## Capture something

Type into Home's quick-add field and choose **Add to Inbox**. You can also press **Ctrl+Shift+Space** to open Quick Capture, type a title, and press Enter. Escape hides that window without saving the draft.

Inbox is a place to capture first and organize later. When you're ready, choose Start Now, schedule a start, or pause the task. [Task workflow](TASK-WORKFLOW.md) explains the choices.

The command palette opens with **Ctrl+K** by default. Its alternative **Ctrl+Shift+P** can be selected in Settings. Quick Capture currently uses the fixed Ctrl+Shift+Space shortcut; another app using it can prevent registration.

## Keep reminders running

With close-to-tray enabled, closing the main window leaves Reprise running. Use its tray menu to reopen it or quit completely. **Quit Reprise** stops background reminders until you launch it again. On launch, overdue return events are reconciled.

Windows notification permissions, Focus / Do Not Disturb, and Reprise's quiet hours can affect reminders. Reprise's notification panel keeps its own history; clearing that history does not clear Windows Notification Center. A submitted notification is not proof that Windows displayed a banner.

## Update manually

Download a newer installer from the appropriate release channel. The signed in-app update feed is not configured, so **Check for updates** cannot currently discover or install GitHub releases. A published GitHub release alone does not connect that feed.

Task data is kept separately from the installed application. Do not delete the application data directory when updating. For feed configuration and technical details, see [Updater integration](UPDATES.md).

## Try Nightly separately

[Nightly releases](https://github.com/Ninefarer/Reprise/releases?q=nightly&expanded=true) are marked Pre-release and contain development changes for testing. Read the notes for the exact build before installing.

Nightly has its own installation and local database. It does not automatically import Stable tasks. Quit one channel before testing Quick Capture in the other because both register Ctrl+Shift+Space.

To report a problem, include your version, whether you're using Stable or Nightly, and the steps to reproduce it in [GitHub issues](https://github.com/Ninefarer/Reprise/issues). Avoid sharing private task content.
