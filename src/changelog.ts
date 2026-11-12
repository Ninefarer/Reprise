const legacyChangelog = [
  {
    date: "November 9, 2026",
    title: "Color with purpose",
    changes: [
      "Soft lifecycle accents across navigation, badges, cards, filters and task actions, with readable light-mode counterparts.",
      "Teal marks Resurfaced review membership separately from the underlying task status.",
      "Notification History is now labeled Notifications, with the subtitle “Waitin’ for ya”.",
    ],
  },
  {
    date: "November 9, 2026",
    title: "Personal space and dependable task actions",
    changes: [
      "Local profile pictures with crop controls and a pinned profile menu.",
      "Resizable, collapsible sidebar with saved preferences.",
      "Status-aware right-click menus on every task, including Finished and Dropped.",
      "Resume restores the previous actionable state; Wake Now and Resurface Now put tasks into review.",
      "Global command palette, view filtering and a configurable command shortcut.",
      "Guarded 30-second Undo for task transitions and native notification diagnostics.",
    ],
  },
  {
    date: "November 9, 2026",
    title: "Task control and navigation",
    changes: [
      "Permanently delete tasks, including their notes, history, reminders and in-app notification records, with confirmation.",
      "Finished and Dropped task cards no longer open details on right-click.",
      "Search is shown on task pages, and hidden in Settings and Notification History.",
      "Read release changes here in Settings.",
    ],
  },
  {
    date: "November 9, 2026",
    title: "A calmer workspace",
    changes: [
      "Grouped sidebar navigation with icons, counts and a dedicated Daily Review page.",
      "Settled and Snoozed views show return times and countdowns; resurfaced tasks have their own queue.",
      "System, Light and Dark appearance with shared palettes across both windows.",
      "Shared task editor, snooze presets, task history and notification filters.",
    ],
  },
  {
    date: "November 9, 2026",
    title: "First local build",
    changes: [
      "SQLite task storage, lifecycle transitions and a persistent Rust reminder scheduler.",
      "Windows notifications, notification history, system tray and Quick Capture.",
    ],
  },
];

export type ReleaseAccent =
  "new" | "little" | "sharp" | "fixes" | "technical" | "known";
export interface ReleaseEntry {
  text: string;
  details?: ReleaseEntry[];
  links?: { label: string; href: string }[];
}
export interface ReleaseSection {
  heading: string;
  accent: ReleaseAccent;
  entries: ReleaseEntry[];
}
export interface Release {
  version: string;
  date: string;
  title: string;
  subtitle?: string;
  sections: ReleaseSection[];
}
export const releases: Release[] = [
  {
    version: "3.3.2",
    date: "2026-11-12",
    title: "Ready when you are.",
    sections: [
      {
        heading: "NEW & NOTEWORTHY",
        accent: "new",
        entries: [
          {
            text: "Reprise checks for updates after setup and while running. Available updates appear in Notifications; you choose when to install.",
          },
          {
            text: "Stable and Nightly keep separate update feeds, installations, and task data.",
          },
          {
            text: "Updates require a valid signature and matching signed version before installation.",
          },
        ],
      },
      {
        heading: "THE LITTLE THINGS",
        accent: "little",
        entries: [
          {
            text: "Install this version manually once to enable in-app updates. Run the installer over your existing Stable installation without uninstalling or deleting its data.",
          },
        ],
      },
    ],
  },
  {
    version: "3.3.1",
    date: "2026-11-12",
    title: "Keep what you just wrote.",
    sections: [
      {
        heading: "BUGS, BEGONE",
        accent: "fixes",
        entries: [
          {
            text: "Fixed unsaved task edits being discarded when choosing Do now, Settle, or Finish in task details. Edited fields are now saved with the status change.",
          },
        ],
      },
    ],
  },
  {
    version: "3.3.0",
    date: "2026-11-12",
    title: "A more thoughtful beginning.",
    subtitle: "A quieter setup, useful right-clicks, and a familiar new face.",
    sections: [
      {
        heading: "NEW & NOTEWORTHY",
        accent: "new",
        entries: [
          {
            text: "A dedicated three-step onboarding flow helps you set up your profile, appearance, return preferences, and optional first task before opening the main interface.",
          },
          {
            text: "Redo onboarding from Settings with confirmation, without resetting your tasks, history, or saved profile.",
          },
          {
            text: "Right-click text fields for working Cut, Copy, Paste, Select All, Undo, and Redo actions, including task details and Quick Capture.",
          },
        ],
      },
      {
        heading: "LOOKING SHARP",
        accent: "sharp",
        entries: [
          {
            text: "Task, navigation, and editing menus share icons, separators, shortcut labels, keyboard navigation, and brief opening and closing animations.",
          },
          {
            text: "Menus follow your theme and remain readable over native Glass, with quieter fallbacks for accessibility preferences.",
          },
          {
            text: "Stable onboarding follows your selected theme. The starry background and Nightly disclosure stay exclusive to Nightly builds.",
          },
          {
            text: "Smoother onboarding transitions respect Animation Off and Windows reduced motion.",
          },
          {
            text: "Original Stable and Nightly artwork now supplies the application, tray, installer, and uninstaller icons for each channel.",
          },
          {
            text: "The repository has a new wordmark-led introduction, a real Stable screenshot, installation and task guides, and illustrated Stable GitHub release notes.",
          },
        ],
      },
      {
        heading: "BUGS, BEGONE",
        accent: "fixes",
        entries: [
          {
            text: "Context menus stay inside the window and remain clickable above task dialogs. Escape restores focus without closing the parent dialog or Quick Capture.",
          },
          {
            text: "Rapid right-clicks no longer let an old closing menu dismiss the new one. Delayed clipboard reads cannot overwrite a field that changed while waiting.",
          },
          {
            text: "Setup no longer exposes the main navigation or an apparent update check. Nightly disclosure waits until setup finishes.",
          },
          {
            text: "Native task reminder clicks open the matching current task after an existing editor closes, and ignore tasks that have been deleted.",
          },
          {
            text: "Finishing or rescheduling cancels stale queued reminders, including quiet-hours reminders. Undo restores only the pending reminders cancelled by that transition.",
          },
        ],
      },
    ],
  },
  {
    version: "3.2.1-nightly.20261112.5",
    date: "2026-11-12",
    title: "Just the sky.",
    sections: [
      {
        heading: "THE LITTLE THINGS",
        accent: "little",
        entries: [
          {
            text: "Removed the Nightly badge from onboarding. The night sky and step indicator remain; the main sidebar still identifies Nightly builds.",
          },
        ],
      },
    ],
  },
  {
    version: "3.2.1-nightly.20261112.4",
    date: "2026-11-12",
    title: "A quieter beginning.",
    sections: [
      {
        heading: "NEW & NOTEWORTHY",
        accent: "new",
        entries: [
          {
            text: "A dedicated three-step setup flow keeps navigation and notifications out of the way until you're ready.",
          },
          {
            text: "Nightly setup borrows the blue-violet night sky, then returns to your selected theme. The Nightly disclosure waits until setup is complete.",
          },
          {
            text: "Redo onboarding from Settings with confirmation, keeping existing tasks, history and preferences.",
          },
          {
            text: "Setup no longer embeds the Settings page or its misleading disabled Checking? update button.",
          },
        ],
      },
    ],
  },
  {
    version: "3.2.1-nightly.20261112.3",
    date: "2026-11-12",
    title: "A hint of violet.",
    sections: [
      {
        heading: "LOOKING SHARP",
        accent: "sharp",
        entries: [
          {
            text: "A faint purple tint on the right side of the Nightly sky blends into the existing bottom fade.",
          },
        ],
      },
    ],
  },
  {
    version: "3.2.1-nightly.20261112.2",
    date: "2026-11-12",
    title: "A small patch of sky.",
    sections: [
      {
        heading: "LOOKING SHARP",
        accent: "sharp",
        entries: [
          {
            text: "A subtle, static night sky behind the sidebar Nightly label fades into the navigation below. It adds no header height and has a light-theme counterpart and accessibility fallbacks.",
          },
        ],
      },
    ],
  },
  {
    version: "3.2.1-nightly.20261112",
    date: "2026-11-12",
    title: "A clearer way back.",
    subtitle: "Nightly prerelease for testing.",
    sections: [
      {
        heading: "BUGS, BEGONE",
        accent: "fixes",
        entries: [
          {
            text: "Native task reminder clicks open the matching task after any existing editor closes. Queued clicks fetch current data and do not reopen deleted tasks.",
          },
          {
            text: "Finishing or rescheduling cancels obsolete queued start/deadline reminders, including reminders held during quiet hours.",
          },
          {
            text: "Undo restores only the pending reminders cancelled by the undone transition, preserving dismissed and submitted history.",
          },
        ],
      },
      {
        heading: "NIGHTLY, CLEARLY",
        accent: "little",
        entries: [
          {
            text: "A compact sidebar Nightly indicator with a subtle fading night sky, plus a startup disclosure and GitHub issue-report link, identify the test channel.",
          },
          {
            text: "Nightly uses a separate installation and local database. Stable 3.2.0 remains unchanged.",
          },
        ],
      },
    ],
  },
  {
    version: "3.2.0",
    date: "2026-11-11",
    title: "A little less friction.",
    subtitle: "More control over reminders. Settings that do their job.",
    sections: [
      {
        heading: "YOUR REMINDERS, YOUR CALL",
        accent: "new",
        entries: [
          {
            text: "Dismiss individual notifications, mark all as read, clear read history or clear all with confirmation.",
          },
          {
            text: "Human-readable categories, searchable history and a Daily Review entry point.",
          },
          {
            text: "Windows toasts now name the task and explain its reminder type. Grouped reminders include specific task details.",
          },
          {
            text: "Retired reminders stay retired across restarts. Clearing local history leaves tasks and Windows Notification Center alone.",
          },
        ],
      },
      {
        heading: "THE LITTLE THINGS",
        accent: "little",
        entries: [
          {
            text: "Quick Capture is now a borderless utility window with a draggable header, close button and clear Enter/Escape hints.",
          },
          {
            text: "Fixed the empty scrollbar gutter along Quick Capture's right edge. Closing keeps the draft; repeated Enter presses cannot create duplicate tasks.",
          },
          {
            text: "Compact density now adjusts navigation, task lists, notifications, settings and dialogs immediately, without hiding task descriptions.",
          },
          {
            text: "Notification reading surfaces stay opaque in Clear Glass and Acrylic so content underneath cannot interfere.",
          },
          {
            text: "Removed the About notification states disclosure from the notification panel.",
          },
          {
            text: "Daily Review uses correct grammar, skips empty days and retains daily deduplication after clearing history.",
          },
          {
            text: "An unconfigured updater reports its status in Settings instead of creating another placeholder reminder.",
          },
        ],
      },
      {
        heading: "UNDER THE HOOD",
        accent: "technical",
        entries: [
          {
            text: "Notification history and management are separated from background scheduling. Transactional operations retain stable reminder identifiers.",
          },
          {
            text: "Live Windows toast clicks can open Daily Review while Reprise remains running.",
          },
          {
            text: "Native Windows toast submission now reports rejection and failure errors instead of relying on a queued background send. Windows acceptance still does not prove visible display.",
          },
        ],
      },
      {
        heading: "KNOWN LIMITS",
        accent: "known",
        entries: [
          {
            text: "Windows decides whether to display notifications. Submission does not confirm display.",
          },
          {
            text: "Reprise must remain running for reminders. Activation after complete process termination is unsupported; Notification Center click behavior has not been verified.",
          },
          {
            text: "Update checks remain manual; a signed release feed has not been configured.",
          },
        ],
      },
    ],
  },
  {
    version: "3.1.1",
    date: "2026-11-09",
    title: "A way forward.",
    sections: [
      {
        heading: "THE LITTLE THINGS",
        accent: "little",
        entries: [
          {
            text: "Check for updates from Settings. Results appear in your in-app Notifications.",
          },
          {
            text: "When a signed update is available, click its notification to download, install and restart.",
          },
        ],
      },
      {
        heading: "UNDER THE HOOD",
        accent: "technical",
        entries: [
          {
            text: "Update checks are manual. Your tasks keep working offline.",
          },
          {
            text: "The release feed is not connected yet. Checks explain this instead of claiming you're up to date.",
          },
        ],
      },
    ],
  },
  {
    version: "3.1.0",
    date: "2026-11-09",
    title: "Room to breathe.",
    subtitle: "Less in the way. The same intentions.",
    sections: [
      {
        heading: "LOOKING SHARP",
        accent: "sharp",
        entries: [
          {
            text: "Aligned task counts across the left sidebar, including All Tasks.",
          },
          {
            text: "Removed the extra bell and Search & commands buttons. Ctrl+K still opens commands; the right edge and Ctrl+Shift+N open Notifications.",
          },
          {
            text: "Neutral Pitch Black and Ashen White surfaces, curated accents and saved animation preferences.",
          },
        ],
      },
      {
        heading: "THE LITTLE THINGS",
        accent: "little",
        entries: [
          {
            text: "Notifications now slide out as well as in. Closing restores focus immediately, and reduced motion skips the transition.",
          },
          {
            text: "Notification rows show useful actions and problems without repeating the technical Submitted label.",
            details: [
              {
                text: "Read applies to Reprise history. Windows notification submission is kept separately; it is not proof of display or reading.",
              },
            ],
          },
          {
            text: "Settings remains in your profile menu. Notifications keeps its own pinnable right panel.",
          },
        ],
      },
      {
        heading: "UNDER THE HOOD",
        accent: "technical",
        entries: [
          {
            text: "Task lifecycle, settlement, snooze, deletion and reminder storage keep their existing behavior.",
          },
          {
            text: "Existing data and preferences are retained when installing this release.",
          },
        ],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-11-09",
    title: "A change of atmosphere.",
    subtitle: "Same intentions. A little more room to make this place yours.",
    sections: [
      {
        heading: "NEW & NOTEWORTHY",
        accent: "new",
        entries: [
          {
            text: "Three theme families: Reprise Classic, Pitch Black and Ashen White.",
            details: [
              {
                text: "Classic keeps Light, Dark and System. Fixed families keep your Classic preference saved for your return.",
              },
            ],
          },
          {
            text: "Flat, Frosted and experimental Glass materials.",
            details: [
              {
                text: "Glass starts with menus only. The sidebar, task lists and main canvas stay solid.",
              },
            ],
          },
          {
            text: "A local What's New experience that remembers which release you acknowledged.",
          },
        ],
      },
      {
        heading: "LOOKING SHARP",
        accent: "sharp",
        entries: [
          {
            text: "Pitch Black and Ashen White use neutral surfaces, with stronger control and secondary-text contrast.",
          },
          {
            text: "A choice of Lavender, Sage, Icy Blue, Rose or Neutral accents for controls. Task colors keep their own meaning.",
          },
          {
            text: "Shared surface tokens, bounded blur controls and independently configurable modal backdrops.",
          },
          {
            text: "Your semantic task colors keep their meaning across all three families. Rest is still lavender.",
          },
        ],
      },
      {
        heading: "THE LITTLE THINGS",
        accent: "little",
        entries: [
          {
            text: "Off, Subtle and Expressive animation preferences. Windows reduced motion takes priority while keeping your choice saved.",
            details: [
              {
                text: "Menus, dialogs and navigation move briefly when used. Successful completion gets a quick check; new review entries get one quiet highlight.",
              },
            ],
          },
          {
            text: "Native scrollbars recede between interactions when Windows allows it. Prefer them always visible? There's a setting.",
          },
          {
            text: "Release history now has version headings, categories and nested details. You are, in fact, reading the feature.",
          },
        ],
      },
      {
        heading: "UNDER THE HOOD",
        accent: "technical",
        entries: [
          {
            text: "Saved visual preferences are applied before the main window is shown.",
          },
          {
            text: "Release acknowledgment is local and compared using semantic versions, including prereleases.",
          },
          {
            text: "Task lifecycle, SQLite task tables and notification scheduling are unchanged. No update downloader was added.",
          },
        ],
      },
      {
        heading: "KNOWN ISSUES",
        accent: "known",
        entries: [
          {
            text: "CSS blur stays inside this app. It cannot turn your desktop into frosted glass.",
          },
          {
            text: "Native date pickers and select popups keep their reliable system styling.",
          },
          {
            text: "Unsupported effects or accessibility preferences use solid surfaces. Glass remains experimental.",
          },
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-11-09",
    title: "A place to return.",
    subtitle: "The first local build and its early refinements.",
    sections: legacyChangelog.map((entry, index) => ({
      heading: entry.title.toUpperCase(),
      accent: (
        ["sharp", "new", "fixes", "little", "technical"] as ReleaseAccent[]
      )[index % 5],
      entries: entry.changes.map((text) => ({ text })),
    })),
  },
];
export const releaseFor = (version: string) =>
  releases.find((release) => release.version === version);
