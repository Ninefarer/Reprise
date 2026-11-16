# Reprise documentation

These files stay in the repository. In-app release notes come from `src/changelog.ts`.

## Using Reprise

- [Getting started](GETTING-STARTED.md): installation, first capture, Settings, updates, and the tray.
- [Task workflow](TASK-WORKFLOW.md): lifecycle states, scheduling, and returning tasks.
- [Full changelog](../CHANGELOG.md): published Stable notes through 3.4.3.
- [Stable and Nightly releases](https://github.com/Ninefarer/Reprise/releases): installers and the descriptions that were published.
- [Release history](RELEASE-HISTORY.md): installer checksums for published Stable builds from 3.2.0 through 3.4.3.

## Building Reprise

- [Build and test](BUILDING.md): prerequisites, commands, and channel configuration.
- [Nightly PWA](PWA.md): web build seam, storage placeholder, and Pages workflow. Not a Stable release.
- [Architecture and reliability](ARCHITECTURE.md): SQLite, scheduling, notifications, Glass, and Windows acceptance checks.
- [Updater integration](UPDATES.md): feeds, signing, and the publication gate.
- [GitHub release conventions](RELEASING.md): separate Stable and Nightly writing rules.
- [Application icons](APP-ICONS.md): original artwork and native icon derivatives.

GitHub release descriptions are the version files in `docs/releases/`. [Stable](releases/stable.md) and [Nightly](releases/nightly.md) templates sit beside them. Release scripts publish the version files. The in-app notes stay in `src/changelog.ts`.

## Engineering records

- [3.4.0 UI/UX acceptance](qa/uiux-3.4.0.md)
- [Window refresh measurements](qa/window-refresh-suspension-2026-11-13.md)
- [Performance baseline](PERFORMANCE-BASELINE.md)
- [Installed-upgrade receipt](updater-acceptance.json)
- [GitHub App development reports](CODEX-ISSUE-REPORTS.md)

These records belong to the builds they name. A passing check there is not a current release matrix.
