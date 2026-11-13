// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { navigation, commandDestinations } from "./navigation";
import { label, type Snapshot } from "./model";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  setTheme: vi.fn(),
  setBackgroundColor: vi.fn(),
  theme: vi.fn(),
  onThemeChanged: vi.fn(),
  onResized: vi.fn(),
  hide: vi.fn(),
  startDragging: vi.fn(),
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => mocks }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: async (
    name: string,
    handler: (event: { payload: unknown }) => void,
  ) => {
    mocks.listeners.set(name, handler);
    return () => mocks.listeners.delete(name);
  },
}));
let data: Snapshot;
beforeEach(() => {
  mocks.listeners.clear();
  data = {
    tasks: [],
    notifications: [],
    release: { version: "3.2.0", acknowledged: "3.2.0", should_show: false },
    settings: {
      name: "Test",
      workspace: "Studio",
      theme: "system",
      density: "comfortable",
      onboarded: true,
      settlement_mode: "24h",
      return_time: "09:00",
      review_time: "09:00",
      daily_review: true,
      quiet_start: "22:00",
      quiet_end: "08:00",
      notifications: true,
      close_to_tray: true,
      startup: false,
      shortcut: "Ctrl+Shift+Space",
      paused: false,
      categories: [],
    },
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  mocks.hide.mockResolvedValue(undefined);
  mocks.startDragging.mockResolvedValue(undefined);
  mocks.theme.mockResolvedValue("light");
  mocks.setTheme.mockResolvedValue(undefined);
  mocks.setBackgroundColor.mockResolvedValue(undefined);
  mocks.onThemeChanged.mockResolvedValue(() => {});
  mocks.onResized.mockResolvedValue(() => {});
  mocks.invoke.mockImplementation(async (cmd, args) => {
    if (cmd === "diagnostics")
      return {
        health: {
          heartbeat: 100,
          scheduler_error: null,
          tray_running: true,
          shortcut_error: null,
        },
        application_id: "com.reprise.desktop",
        registration: "Not verified",
        last_submission: null,
        errors: [],
      };
    if (cmd === "sidebar_preferences") {
      data.settings.sidebar_collapsed =
        args.collapsed ?? data.settings.sidebar_collapsed;
      data.settings.sidebar_width = args.width ?? data.settings.sidebar_width;
      if (args.groups)
        data.settings.sidebar_groups = {
          ...data.settings.sidebar_groups,
          ...args.groups,
        };
      return;
    }
    if (cmd === "snapshot") return structuredClone(data);
    if (cmd === "notification_panel_preferences") {
      data.settings.notification_panel_pinned = args.pinned;
      return;
    }
    if (cmd === "read_notice") {
      data.notifications = data.notifications.map((n) =>
        n.id === args.id ? { ...n, read: true } : n,
      );
      return;
    }
    if (cmd === "visual_preferences") {
      Object.assign(data.settings, args.patch);
      return;
    }
    if (cmd === "acknowledge_release" && data.release) {
      data.release.acknowledged = args.version;
      data.release.should_show = false;
      return;
    }
    if (cmd === "save_settings") {
      data.settings = args.settings;
      return;
    }
    if (cmd === "delete_task") {
      data.tasks = data.tasks.filter((t) => t.id !== args.id);
      return;
    }
    return [];
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText(/Profile menu for/));
  await user.click(await screen.findByRole("menuitem", { name: "Settings" }));
}
describe("native-window snapshot suspension", () => {
  function suspendSnapshots() {
    let suspended = false;
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) =>
      cmd === "snapshot" && args?.background && suspended
        ? null
        : original(cmd, args),
    );
    return (value: boolean) => {
      suspended = value;
    };
  }
  it("initializes hidden windows once and preserves the view when periodic reads are skipped", async () => {
    vi.useFakeTimers();
    try {
      const suspend = suspendSnapshots();
      suspend(true);
      render(<App />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mocks.invoke).toHaveBeenCalledWith("snapshot");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(45001);
      });
      expect(
        mocks.invoke.mock.calls.filter(
          ([cmd, args]) => cmd === "snapshot" && args?.background,
        ),
      ).toHaveLength(3);
      expect(screen.getByRole("navigation")).toBeTruthy();
      expect(screen.queryByText("Opening Reprise…")).toBeNull();
      expect(
        mocks.invoke.mock.calls.some(
          ([cmd, args]) => cmd === "check_updates" && args?.automatic,
        ),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("refreshes tasks and countdowns immediately after six hours without waiting for a poll", async () => {
    const now = Math.floor(Date.now() / 1000);
    data.tasks = [
      {
        ...closedTask("Finished"),
        title: "Long pause",
        status: "Snoozed",
        completed_at: null,
        wake_at: now + 7 * 3600,
      },
    ];
    const suspend = suspendSnapshots();
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Snoozed\s*1 items$/ }),
    );
    expect(screen.getByText(/Returns in 7h/)).toBeTruthy();
    suspend(true);
    data.tasks.push({
      ...data.tasks[0],
      id: "returned",
      title: "Returned while hidden",
      status: "Settled",
      review_at: now + 100,
      review_reason: "Settled reminder",
    });
    await act(async () => {
      mocks.listeners.get("refresh")!({ payload: null });
    });
    expect(
      screen.queryByRole("button", { name: /^Resurfaced\s*1 items$/ }),
    ).toBeNull();
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue((now + 6 * 3600) * 1000);
    try {
      suspend(false);
      fireEvent.focus(window);
      await screen.findByText("Returns in 1h 0m");
      expect(
        screen.getByRole("button", { name: /^Resurfaced\s*1 items$/ }),
      ).toBeTruthy();
    } finally {
      clock.mockRestore();
    }
  });
  it("preserves an edited task draft and exposes revision conflicts after restoring", async () => {
    data.tasks = [
      { ...closedTask("Finished"), status: "Inbox", completed_at: null },
    ];
    const suspend = suspendSnapshots();
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "save_task")
        throw Error("This task changed elsewhere. Reload and try again.");
      return original(cmd, args);
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Inbox\s*1 items$/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Finished intention" }),
    );
    const title = screen.getByLabelText("Title") as HTMLInputElement;
    await user.clear(title);
    await user.type(title, "Keep my unsaved draft");
    suspend(true);
    data.tasks[0] = {
      ...data.tasks[0],
      title: "Changed elsewhere",
      updated_at: 999,
    };
    await act(async () => {
      mocks.listeners.get("refresh")!({ payload: null });
    });
    suspend(false);
    fireEvent.focus(window);
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("snapshot", {
        background: true,
      }),
    );
    expect(title.value).toBe("Keep my unsaved draft");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await within(screen.getByRole("dialog", { name: "Edit task" })).findByRole(
      "alert",
    );
    expect(title.value).toBe("Keep my unsaved draft");
  });
  it("catches up on native restore without a focus event and avoids fetching on ordinary resize", async () => {
    const suspend = suspendSnapshots();
    render(<App />);
    await screen.findByRole("navigation");
    const resize = mocks.onResized.mock.calls[0][0] as () => void;
    mocks.invoke.mockClear();
    await act(async () => resize());
    expect(mocks.invoke.mock.calls.some(([cmd]) => cmd === "snapshot")).toBe(
      false,
    );
    suspend(true);
    await act(async () => {
      mocks.listeners.get("refresh")!({ payload: null });
    });
    data.tasks = [
      { ...closedTask("Finished"), status: "Inbox", completed_at: null },
    ];
    suspend(false);
    await act(async () => resize());
    expect(
      screen.getByRole("button", { name: /^Inbox\s*1 items$/ }),
    ).toBeTruthy();
    mocks.invoke.mockClear();
    await act(async () => resize());
    expect(mocks.invoke.mock.calls.some(([cmd]) => cmd === "snapshot")).toBe(
      false,
    );
  });
  it("preserves a Settings draft while applying fresh appearance on restore", async () => {
    const suspend = suspendSnapshots();
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.type(screen.getByLabelText("Display name"), " unsaved");
    suspend(true);
    data.settings.theme_family = "pitch-black";
    await act(async () => {
      mocks.listeners.get("refresh")!({ payload: null });
    });
    suspend(false);
    fireEvent.focus(window);
    await waitFor(() =>
      expect(document.documentElement.dataset.family).toBe("pitch-black"),
    );
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Test unsaved");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });
  it("retains the background gate when a refresh is queued behind initialization", async () => {
    let resolve!: (value: Snapshot) => void;
    const original = mocks.invoke.getMockImplementation()!;
    let first = true;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "snapshot" && first) {
        first = false;
        return new Promise<Snapshot>((r) => {
          resolve = r;
        });
      }
      if (cmd === "snapshot" && args?.background) return null;
      return original(cmd, args);
    });
    render(<App />);
    await act(async () => {
      await Promise.resolve();
      mocks.listeners.get("refresh")!({ payload: null });
      resolve(structuredClone(data));
    });
    await screen.findByRole("navigation");
    expect(
      mocks.invoke.mock.calls.filter(([cmd]) => cmd === "snapshot"),
    ).toEqual([["snapshot"], ["snapshot", { background: true }]]);
  });
  it("cleans up a native restore listener that resolves after unmount", async () => {
    let resolve!: (off: () => void) => void;
    const off = vi.fn();
    mocks.onResized.mockImplementation(
      () =>
        new Promise<() => void>((r) => {
          resolve = r;
        }),
    );
    const app = render(<App />);
    app.unmount();
    await act(async () => {
      resolve(off);
    });
    expect(off).toHaveBeenCalledOnce();
  });
});
describe("Settings draft protection", () => {
  it("keeps edits when staying and discards only after an explicit choice", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Unsaved name");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Home" }));
    let dialog = screen.getByRole("dialog", {
      name: "Save your Settings changes?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    );
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Unsaved name");
    await user.click(screen.getByRole("button", { name: "Home" }));
    dialog = screen.getByRole("dialog", {
      name: "Save your Settings changes?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Discard changes" }),
    );
    expect(data.settings.name).toBe("Test");
    await openSettings(user);
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Test");
  });
  it("saves before completing the requested navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Saved name");
    await user.click(screen.getByRole("button", { name: "Home" }));
    const dialog = screen.getByRole("dialog", {
      name: "Save your Settings changes?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Save and continue" }),
    );
    await screen.findByLabelText(/Profile menu for Saved name/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText("Display name")).toBeNull();
  });
  it("retains the draft and navigation prompt if saving fails", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "save_settings") throw Error("Storage unavailable");
      return original(cmd, args);
    });
    await user.type(screen.getByLabelText("Display name"), " edited");
    await user.click(screen.getByRole("button", { name: "Home" }));
    const dialog = screen.getByRole("dialog", {
      name: "Save your Settings changes?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Save and continue" }),
    );
    await within(dialog).findByRole("alert");
    expect(data.settings.name).toBe("Test");
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Test edited");
  });
  it("does not call appearance-only changes unsaved", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Theme"), "pitch-black");
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(data.settings.theme_family).toBe("pitch-black");
  });
});

it.each([
  [true, false, 1],
  [false, false, 0],
  [true, true, 0],
] as const)(
  "automatically checks only the onboarded main window (%s,%s)",
  async (onboarded, capture, expected) => {
    vi.useFakeTimers();
    try {
      data.settings.onboarded = onboarded;
      const app = render(<App captureMode={capture} />);
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30001);
      });
      expect(
        mocks.invoke.mock.calls.filter(
          ([cmd, args]) => cmd === "check_updates" && args?.automatic,
        ),
      ).toHaveLength(expected);
      app.unmount();
      const count = mocks.invoke.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(mocks.invoke.mock.calls).toHaveLength(count);
    } finally {
      vi.useRealTimers();
    }
  },
);
describe("Nightly channel", () => {
  it.each([
    ["3.3.0", false],
    ["3.2.1-nightly.20261112.5", true],
  ] as const)(
    "keeps the onboarding sky exclusive to Nightly: %s",
    async (version, sky) => {
      data.settings.onboarded = false;
      data.settings.theme_family = "pitch-black";
      data.release = { version, acknowledged: null, should_show: false };
      render(<App />);
      await screen.findByRole("heading", {
        name: "Set up your space.",
      });
      expect(!!document.querySelector(".setup-nightly")).toBe(sky);
      expect(document.documentElement.dataset.family).toBe("pitch-black");
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );
  it("keeps first-run setup separate and shows the nightly disclosure only after finishing", async () => {
    data.settings.onboarded = false;
    data.release = {
      version: "3.2.1-nightly.20261112",
      acknowledged: null,
      should_show: false,
    };
    const user = userEvent.setup();
    const app = render(<App />);
    await screen.findByRole("heading", {
      name: "Set up your space.",
    });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("note", { name: /Nightly build/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Check for updates" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Search tasks")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Skip setup" }));
    const disclosure = await screen.findByRole("dialog", {
      name: "You're running Reprise Nightly",
    });
    expect(screen.queryByRole("dialog", { name: "What's New" })).toBeNull();
    expect(
      within(disclosure)
        .getByRole("link", { name: /Report an issue on GitHub/ })
        .getAttribute("href"),
    ).toBe("https://github.com/Ninefarer/Reprise/issues/new");
    await user.click(
      within(disclosure).getByRole("link", {
        name: /Report an issue on GitHub/,
      }),
    );
    expect(mocks.invoke).toHaveBeenCalledWith("open_issue_report");
    await user.click(
      within(disclosure).getByRole("button", { name: "Continue to Nightly" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => mocks.listeners.get("refresh")!({ payload: null }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("note", { name: /Nightly build/ })).toBeTruthy();
    app.unmount();
    render(<App />);
    await screen.findByRole("dialog", {
      name: "You're running Reprise Nightly",
    });
  });
  it("completes focused steps, saves profile and attention preferences, and adds an optional Inbox task", async () => {
    data.settings.onboarded = false;
    const originalInvoke = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "capture") {
        data.tasks.push({
          ...closedTask("Finished"),
          status: "Inbox",
          id: "first",
          title: args.title,
        });
        return;
      }
      return originalInvoke(cmd, args);
    });
    const user = userEvent.setup();
    const app = render(<App />);
    await user.clear(await screen.findByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Dim");
    await user.clear(screen.getByLabelText("Space name"));
    await user.type(screen.getByLabelText("Space name"), "field");
    await user.selectOptions(screen.getByLabelText("Theme"), "pitch-black");
    await waitFor(() => expect(data.settings.theme_family).toBe("pitch-black"));
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    await screen.findByRole("heading", { name: "Choose when tasks return." });
    await user.selectOptions(
      screen.getByLabelText("Settled tasks return"),
      "next_day",
    );
    fireEvent.change(screen.getByLabelText("Preferred return time"), {
      target: { value: "10:30" },
    });
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    expect(screen.getByLabelText("Display name").getAttribute("value")).toBe(
      "Dim",
    );
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    await user.type(screen.getByLabelText("Your first task"), "Plan tomorrow");
    await user.click(screen.getByRole("button", { name: "Open Reprise" }));
    await screen.findByLabelText(/Profile menu for Dim/);
    expect(data.settings).toMatchObject({
      name: "Dim",
      workspace: "field",
      onboarded: true,
      settlement_mode: "next_day",
      return_time: "10:30",
      theme_family: "pitch-black",
    });
    expect(data.tasks.some((t) => t.title === "Plan tomorrow")).toBe(true);
    expect(mocks.invoke).not.toHaveBeenCalledWith("check_updates");
    app.unmount();
    render(<App />);
    await screen.findByLabelText(/Profile menu for Dim/);
    expect(
      screen.queryByRole("heading", {
        name: "Set up your space.",
      }),
    ).toBeNull();
  });
  it("confirms replay and preserves tasks and settings without marking the user un-onboarded", async () => {
    data.tasks = [
      { ...closedTask("Finished"), id: "existing", title: "Keep my intention" },
    ];
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.click(screen.getByRole("button", { name: "Redo onboarding" }));
    let dialog = screen.getByRole("dialog", {
      name: "Go through setup again?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Keep working" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Redo onboarding" }));
    dialog = screen.getByRole("dialog", { name: "Go through setup again?" });
    await user.click(
      within(dialog).getByRole("button", { name: "Redo onboarding" }),
    );
    await screen.findByLabelText("Display name");
    expect(data.settings.onboarded).toBe(true);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(data.tasks).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Cancel setup" }));
    await screen.findByRole("button", { name: "Redo onboarding" });
    expect(data.settings.name).toBe("Test");
    expect(data.tasks[0].title).toBe("Keep my intention");
  });
  it("finishes a replay without deleting existing data or repeating the nightly disclosure", async () => {
    data.release = {
      version: "3.2.1-nightly.20261112.4",
      acknowledged: null,
      should_show: false,
    };
    data.tasks = [closedTask("Finished")];
    data.notifications = [
      {
        id: "kept",
        task_id: null,
        category: "Diagnostic",
        title: "Keep this",
        message: "A saved record",
        created_at: 100,
        scheduled_at: 100,
        submitted_at: null,
        state: "Pending",
        read: false,
      },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Continue to Nightly" }),
    );
    await openSettings(user);
    await user.click(screen.getByRole("button", { name: "Redo onboarding" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Redo onboarding",
      }),
    );
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "New name");
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: "Open Reprise" }));
    await screen.findByLabelText(/Profile menu for New name/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(data.tasks).toEqual([closedTask("Finished")]);
    expect(data.notifications[0].id).toBe("kept");
    expect(data.settings.workspace).toBe("Studio");
    expect(
      mocks.invoke.mock.calls.some(([cmd]) => /delete|clear/.test(cmd)),
    ).toBe(false);
  });
  it("keeps setup editable after a save failure and does not duplicate the captured task on retry", async () => {
    data.settings.onboarded = false;
    const originalInvoke = mocks.invoke.getMockImplementation()!;
    let fail = true;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "capture") {
        data.tasks.push({
          ...closedTask("Finished"),
          status: "Inbox",
          title: args.title,
        });
        return;
      }
      if (cmd === "save_settings" && fail) {
        fail = false;
        throw new Error("Could not save preferences");
      }
      return originalInvoke(cmd, args);
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /Continue/ }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() =>
      expect(
        (document.querySelector(".setup-fields") as HTMLFieldSetElement)
          .disabled,
      ).toBe(false),
    );
    await user.type(screen.getByLabelText("Your first task"), "Only once");
    await user.click(screen.getByRole("button", { name: "Open Reprise" }));
    await screen.findByRole("alert");
    expect(data.settings.onboarded).toBe(false);
    await user.click(screen.getByRole("button", { name: "Open Reprise" }));
    await screen.findByLabelText(/Profile menu for/);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].title).toBe("Only once");
  });
  it("allows the outgoing setup transition to finish before advancing and respects Animation Off", async () => {
    data.settings.onboarded = false;
    render(<App />);
    const next = await screen.findByRole("button", { name: /Continue/ });
    fireEvent.click(next);
    expect(
      (document.querySelector(".setup-fields") as HTMLFieldSetElement).disabled,
    ).toBe(true);
    expect(
      screen.getByRole("heading", {
        name: "Set up your space.",
      }),
    ).toBeTruthy();
    const second = await screen.findByRole("heading", {
      name: "Choose when tasks return.",
    });
    expect(document.activeElement).toBe(second);
    document.documentElement.dataset.motion = "off";
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(
      (document.querySelector(".setup-fields") as HTMLFieldSetElement).disabled,
    ).toBe(false);
  });
  it("does not show a startup disclosure in Quick Capture", async () => {
    data.release = {
      version: "3.2.1-nightly.20261112",
      acknowledged: null,
      should_show: true,
    };
    render(<App captureMode />);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("snapshot"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
describe("workspace UI", () => {
  it("saves native Glass options and intensity without changing palette preferences", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.selectOptions(
      screen.getByLabelText("Window appearance"),
      "glass",
    );
    await user.selectOptions(
      screen.getByLabelText("Glass material"),
      "acrylic",
    );
    await waitFor(() => expect(data.settings.desktop_material).toBe("acrylic"));
    expect(data.settings.desktop_glass).toBe(true);
    expect(data.settings.theme).toBe("system");
    await user.selectOptions(
      screen.getByLabelText("Glass intensity"),
      "balanced",
    );
    await waitFor(() => expect(data.settings.desktop_tint).toBe(60));
    await user.selectOptions(
      screen.getByLabelText("Window appearance"),
      "default",
    );
    await waitFor(() => expect(data.settings.desktop_glass).toBe(false));
    expect(data.settings.desktop_material).toBe("acrylic");
  });
  it("does not retain completion feedback when animation is off", async () => {
    data.settings.animation = "off";
    data.tasks = [
      { ...closedTask("Finished"), status: "Inbox", completed_at: null },
    ];
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "save_task") {
        data.tasks = [{ ...args.task, updated_at: 300, completed_at: 300 }];
        return data.tasks[0];
      }
      return original(cmd, args);
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Inbox\s*1 items$/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Finish Finished intention" }),
    );
    expect(data.tasks[0].status).toBe("Finished");
    expect(
      screen.queryByRole("status", { name: "Finished Finished intention" }),
    ).toBeNull();
  });
  it("persists accent and motion while Windows can suppress motion without overwriting the choice", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Accent color"), "lavender");
    await user.selectOptions(screen.getByLabelText("Animation"), "expressive");
    await waitFor(() =>
      expect(document.documentElement.dataset.accent).toBe("lavender"),
    );
    expect(document.documentElement.dataset.motion).toBe("expressive");
    expect(data.settings.animation).toBe("expressive");
    data.system_visuals = {
      advanced_effects: true,
      auto_hide_scrollbars: true,
      animations_enabled: false,
    };
    fireEvent.focus(window);
    await waitFor(() =>
      expect(document.documentElement.dataset.motion).toBe("off"),
    );
    expect(data.settings.animation).toBe("expressive");
    await user.selectOptions(screen.getByLabelText("Theme"), "pitch-black");
    expect(document.documentElement.dataset.accent).toBe("lavender");
    await user.selectOptions(screen.getByLabelText("Accent color"), "theme");
    await waitFor(() =>
      expect(document.documentElement.dataset.accent).toBe("neutral"),
    );
  });
  it("persists completion before its noninteractive visual feedback ends", async () => {
    data.tasks = [
      { ...closedTask("Finished"), status: "Inbox", completed_at: null },
    ];
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "save_task") {
        const saved = { ...args.task, updated_at: 300, completed_at: 300 };
        data.tasks = [saved];
        return saved;
      }
      return original(cmd, args);
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Inbox\s*1 items$/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Finish Finished intention" }),
    );
    expect(data.tasks[0].status).toBe("Finished");
    expect(
      screen.getByRole("status", { name: "Finished Finished intention" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Finish Finished intention" }),
    ).toBeNull();
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: "Finished Finished intention" }),
      ).toBeNull(),
    );
    expect(data.tasks[0].status).toBe("Finished");
  });
  it("highlights a new review entry once without changing its lifecycle or replaying on refresh", async () => {
    data.tasks = [
      { ...closedTask("Finished"), status: "Settled", completed_at: null },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Resurfaced$/ }),
    );
    data.tasks[0].review_at = 400;
    data.tasks[0].review_reason = "Settled";
    fireEvent.focus(window);
    const title = await screen.findByText("Finished intention", {
      selector: "button.task-title",
    });
    expect(
      title.closest("article")?.classList.contains("newly-resurfaced"),
    ).toBe(true);
    expect(data.tasks[0].status).toBe("Settled");
    await waitFor(
      () =>
        expect(
          title.closest("article")?.classList.contains("newly-resurfaced"),
        ).toBe(false),
      { timeout: 1800 },
    );
    fireEvent.focus(window);
    await waitFor(() =>
      expect(
        title.closest("article")?.classList.contains("newly-resurfaced"),
      ).toBe(false),
    );
    expect(data.tasks[0].review_at).toBe(400);
  });
  it("starts with navigation rather than a branding header and retains the utility toggle", async () => {
    render(<App />);
    const nav = await screen.findByRole("navigation", {
      name: "Main navigation",
    });
    const sidebar = nav.closest("aside")!;
    expect(sidebar.querySelector(".brand, .sidebar-head")).toBeNull();
    expect(sidebar.querySelector("nav")).toBe(sidebar.firstElementChild);
    expect(
      within(nav).getByRole("button", { name: "Collapse sidebar" }),
    ).toBeTruthy();
    expect(
      within(sidebar).getByLabelText("Profile menu for Test"),
    ).toBeTruthy();
  });
  it("retains Classic appearance while fixed families and glass settings change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Theme"), "pitch-black");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    expect(data.settings.theme).toBe("system");
    expect(
      screen.getByLabelText("Appearance mode").getAttribute("readonly"),
    ).not.toBeNull();
    expect(screen.queryByLabelText("Material")).toBeNull();
    expect(screen.queryByLabelText("Glass coverage")).toBeNull();
    expect(screen.queryByText("Experimental Glass")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Theme"), "ashen-white");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
    await user.selectOptions(screen.getByLabelText("Theme"), "classic");
    expect(
      ((await screen.findByLabelText("Appearance mode")) as HTMLSelectElement)
        .value,
    ).toBe("system");
  });
  it("reports notification submission honestly and recovers after failure", async () => {
    data.release = {
      version: "3.2.1-nightly.20261112.5",
      acknowledged: null,
      should_show: false,
    };
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Continue to Nightly" }),
    );
    await openSettings(user);
    await user.click(screen.getByText("Advanced / Diagnostics"));
    const original = mocks.invoke.getMockImplementation()!;
    let fail = true;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "test_notification" && fail)
        throw Error("Windows unavailable");
      return original(cmd, args);
    });
    const test = screen.getByRole("button", {
      name: "Test Windows notification",
    });
    await user.click(test);
    await screen.findByText("Error: Windows unavailable");
    fail = false;
    await user.click(test);
    await screen.findByText(
      "Submitted to Windows. This does not confirm display.",
    );
    expect(screen.queryByText("Error: Windows unavailable")).toBeNull();
  });
  it("opens the task identified by a native toast", async () => {
    data.tasks = [
      { ...closedTask("Finished"), status: "Inbox", completed_at: null },
    ];
    render(<App />);
    await screen.findByRole("navigation");
    await waitFor(() =>
      expect(mocks.listeners.has("notification-route")).toBe(true),
    );
    await act(async () =>
      mocks.listeners.get("notification-route")!({
        payload: { review: false, task_id: data.tasks[0].id },
      }),
    );
    await screen.findByRole("dialog");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      data.tasks[0].title,
    );
  });
  it("queues a toast task without replacing an unsaved editor", async () => {
    data.tasks = [
      {
        ...closedTask("Finished"),
        id: "first",
        title: "First",
        status: "Inbox",
        completed_at: null,
      },
      {
        ...closedTask("Finished"),
        id: "second",
        title: "Second",
        status: "Inbox",
        completed_at: null,
      },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    await waitFor(() =>
      expect(mocks.listeners.has("notification-route")).toBe(true),
    );
    await act(async () =>
      mocks.listeners.get("notification-route")!({
        payload: { review: false, task_id: "first" },
      }),
    );
    const title = await screen.findByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Unsaved draft");
    await act(async () =>
      mocks.listeners.get("notification-route")!({
        payload: { review: false, task_id: "second" },
      }),
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Unsaved draft",
    );
    await user.click(
      screen.getByRole("button", { name: "Close task details" }),
    );
    await waitFor(() =>
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
        "Second",
      ),
    );
    expect(mocks.invoke.mock.calls.some(([cmd]) => cmd === "save_task")).toBe(
      false,
    );
  });
  it("does not reopen a queued task deleted while another editor was open", async () => {
    data.tasks = [
      {
        ...closedTask("Finished"),
        id: "first",
        title: "First",
        status: "Inbox",
        completed_at: null,
      },
      {
        ...closedTask("Finished"),
        id: "second",
        title: "Second",
        status: "Inbox",
        completed_at: null,
      },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    await waitFor(() =>
      expect(mocks.listeners.has("notification-route")).toBe(true),
    );
    await act(async () =>
      mocks.listeners.get("notification-route")!({
        payload: { review: false, task_id: "first" },
      }),
    );
    await screen.findByLabelText("Title");
    await act(async () =>
      mocks.listeners.get("notification-route")!({
        payload: { review: false, task_id: "second" },
      }),
    );
    data.tasks = data.tasks.filter((t) => t.id !== "second");
    await user.click(
      screen.getByRole("button", { name: "Close task details" }),
    );
    await screen.findByRole("complementary", { name: "Notifications" });
    expect(screen.queryByLabelText("Title")).toBeNull();
  });
  it("routes reported native review activation and cleans up its listener", async () => {
    const app = render(<App />);
    await screen.findByRole("navigation");
    await waitFor(() =>
      expect(mocks.listeners.has("notification-route")).toBe(true),
    );
    await act(async () =>
      mocks.listeners.get("notification-route")!({
        payload: { review: true, task_id: null },
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Daily Review", level: 1 }),
    ).toBeTruthy();
    app.unmount();
    expect(mocks.listeners.has("notification-route")).toBe(false);
  });
  it("resets document scroll when navigating from a long settings page", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    document.documentElement.scrollTop = 400;
    document.body.scrollTop = 400;
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });
  it("applies density immediately and keeps it through theme and view changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Density"), "compact");
    await waitFor(() =>
      expect(document.documentElement.dataset.density).toBe("compact"),
    );
    await user.selectOptions(screen.getByLabelText("Theme"), "ashen-white");
    expect(data.settings.density).toBe("compact");
    await user.click(screen.getByRole("button", { name: "Home" }));
    await openSettings(user);
    expect((screen.getByLabelText("Density") as HTMLSelectElement).value).toBe(
      "compact",
    );
  });
  it("does not create or open notifications when an update source is absent", async () => {
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) =>
      cmd === "check_updates"
        ? { notice_id: null, message: "Update source not configured." }
        : original(cmd, args),
    );
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    await screen.findByText("Update source not configured.");
    expect(data.notifications).toHaveLength(0);
    expect(
      screen.queryByRole("complementary", { name: "Notifications" }),
    ).toBeNull();
  });
  it("keeps diagnostics and notification tests out of stable Settings", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    expect(screen.queryByText("Advanced / Diagnostics")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Test Windows notification" }),
    ).toBeNull();
    expect(mocks.invoke.mock.calls.some(([cmd]) => cmd === "diagnostics")).toBe(
      false,
    );
    expect(
      screen.getByRole("heading", {
        name: "Notifications and background behavior",
      }),
    ).toBeTruthy();
  });
  it("shows nightly-only diagnostics on demand and filters release history to the nightly channel", async () => {
    data.release = {
      version: "3.2.1-nightly.20261112.5",
      acknowledged: null,
      should_show: false,
    };
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Continue to Nightly" }),
    );
    await openSettings(user);
    expect(screen.queryByRole("button", { name: "What's New" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Test Windows notification" }),
    ).toBeNull();
    expect(mocks.invoke.mock.calls.some(([cmd]) => cmd === "diagnostics")).toBe(
      false,
    );
    await user.click(screen.getByText("Advanced / Diagnostics"));
    await screen.findByText("com.reprise.desktop");
    const diagnostic = screen
      .getByRole("heading", { name: "Notification diagnostics" })
      .closest("details")!;
    expect(
      within(diagnostic).getByRole("button", {
        name: "Test Windows notification",
      }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Release Notes history" }),
    );
    const versions = within(screen.getByLabelText("Version")).getAllByRole(
      "option",
    );
    expect(versions.length).toBeGreaterThan(1);
    expect(
      versions.every((option) =>
        (option as HTMLOptionElement).value.includes("-nightly."),
      ),
    ).toBe(true);
  });
  it("waits for an idle Home view, acknowledges What's New, and does not repeat it", async () => {
    data.release = {
      version: "0.2.0",
      acknowledged: "0.1.0",
      should_show: true,
    };
    const focused = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const user = userEvent.setup();
    const app = render(<App />);
    await openSettings(user);
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(screen.queryByRole("dialog", { name: "What's New" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Home" }));
    await screen.findByRole(
      "dialog",
      { name: "What's New" },
      { timeout: 3500 },
    );
    await user.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(data.release?.should_show).toBe(false));
    expect(mocks.invoke).toHaveBeenCalledWith("acknowledge_release", {
      version: "0.2.0",
    });
    app.unmount();
    render(<App />);
    await screen.findByRole("navigation");
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(screen.queryByRole("dialog", { name: "What's New" })).toBeNull();
    focused.mockRestore();
  }, 10000);
  it("reaches every sidebar page and shows search only on task pages", async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = await screen.findByRole("navigation");
    for (const destination of navigation.flatMap((g) => g.items)) {
      const button = within(nav).getByRole("button", {
        name: new RegExp(`^${label(destination)}(?:\\s*\\d+ items)?$`),
      });
      await user.click(button);
      expect(button.getAttribute("aria-current")).toBe("page");
      const search = screen.queryByRole("textbox", { name: "Search tasks" });
      if (destination === "Settings" || destination === "Notification History")
        expect(search).toBeNull();
      else expect(search).toBeTruthy();
      if (destination !== "Home")
        expect(
          screen.getByRole("heading", { level: 1, name: label(destination) }),
        ).toBeTruthy();
    }
    expect(
      screen.queryByText("Local to this device · No account needed"),
    ).toBeNull();
  });
  it("persists appearance immediately and uses the native window theme API", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Appearance mode"), "dark");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    expect(data.settings.theme).toBe("dark");
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
    await user.selectOptions(
      screen.getByLabelText("Appearance mode"),
      "system",
    );
    await waitFor(() => expect(mocks.setTheme).toHaveBeenLastCalledWith(null));
  });
  it("responds to native theme change events in System mode", async () => {
    let handler: (e: { payload: string }) => void = () => {};
    mocks.onThemeChanged.mockImplementation(async (fn) => {
      handler = fn;
      return () => {};
    });
    render(<App />);
    await screen.findByRole("navigation");
    await waitFor(() => expect(mocks.onThemeChanged).toHaveBeenCalled());
    handler({ payload: "dark" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    handler({ payload: "light" });
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

function closedTask(status: "Finished" | "Dropped") {
  return {
    id: status,
    title: `${status} intention`,
    description: "notes",
    status,
    priority: 0,
    energy: "",
    created_at: 100,
    updated_at: 200,
    scheduled_at: null,
    due_at: null,
    wake_at: null,
    completed_at: status === "Finished" ? 200 : null,
    project: "",
    tags: "",
    recurrence: "",
    reason: "",
    review_at: null,
    review_reason: null,
    parent_task_id: null,
  };
}
describe("closed tasks and deletion", () => {
  it.each(["Finished", "Dropped"] as const)(
    "shows only relevant right-click actions for %s tasks",
    async (status) => {
      data.tasks = [closedTask(status)];
      const user = userEvent.setup();
      render(<App />);
      await user.click(
        await screen.findByRole("button", {
          name: new RegExp(`^${status}\\s*1 items$`),
        }),
      );
      const card = screen.getByText(`${status} intention`).closest("article")!;
      fireEvent.contextMenu(card);
      expect(
        screen.getByRole("menu", { name: `Actions for ${status} intention` }),
      ).toBeTruthy();
      expect(
        within(
          screen.getByRole("menu", { name: `Actions for ${status} intention` }),
        )
          .getAllByRole("menuitem")
          .map((el) => el.textContent),
      ).toEqual([
        expect.stringContaining(status === "Finished" ? "Reopen" : "Restore"),
        expect.stringContaining("View History"),
        expect.stringContaining("Delete Permanently"),
      ]);
      expect(mocks.invoke.mock.calls.some((c) => c[0] === "task_history")).toBe(
        false,
      );
    },
  );
  it("requires confirmation, allows cancellation, then deletes and refreshes counts", async () => {
    data.tasks = [closedTask("Dropped")];
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Dropped\s*1 items$/ }),
    );
    await user.click(screen.getByRole("button", { name: /^More actions for/ }));
    await user.click(
      screen.getByRole("menuitem", { name: "Delete Permanently" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Delete this task?" }),
    ).toBeTruthy();
    expect(mocks.invoke.mock.calls.some((c) => c[0] === "delete_task")).toBe(
      false,
    );
    await user.click(screen.getByRole("button", { name: "Keep task" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(data.tasks).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /^More actions for/ }));
    await user.click(
      screen.getByRole("menuitem", { name: "Delete Permanently" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Dropped intention")).toBeNull(),
    );
    expect(mocks.invoke).toHaveBeenCalledWith("delete_task", {
      id: "Dropped",
      expectedUpdatedAt: 200,
    });
    expect(data.tasks).toHaveLength(0);
    expect(screen.getByRole("button", { name: /^Dropped$/ })).toBeTruthy();
  });
  it("keeps the task and confirmation visible when deletion fails", async () => {
    data.tasks = [closedTask("Finished")];
    const defaultInvoke = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "delete_task") throw Error("Database is busy");
      return defaultInvoke(cmd, args);
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Finished\s*1 items$/ }),
    );
    await user.click(screen.getByRole("button", { name: /^More actions for/ }));
    await user.click(
      screen.getByRole("menuitem", { name: "Delete Permanently" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete this task?" });
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "Database is busy",
      ),
    );
    expect(data.tasks).toHaveLength(1);
  });
  it("shows the changelog in Settings", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    expect(
      screen.getByRole("heading", { name: "About / Updates" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Release Notes history" }),
    );
    await user.selectOptions(screen.getByLabelText("Version"), "0.1.0");
    expect(screen.getByText("TASK CONTROL AND NAVIGATION")).toBeTruthy();
  });
});

describe("personalization and command palette", () => {
  it("opens global search from Settings by keyboard and finds closed tasks", async () => {
    data.tasks = [closedTask("Finished")];
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.keyboard("{Control>}k{/Control}");
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    await user.type(
      within(palette).getByRole("textbox", {
        name: "Global task and command search",
      }),
      "Finished intention",
    );
    expect(
      within(palette).getByRole("button", {
        name: "Finished intention · Finished",
      }),
    ).toBeTruthy();
    await user.click(
      within(palette).getByRole("button", {
        name: "Actions for Finished intention",
      }),
    );
    expect(
      within(palette).getByRole("button", { name: "Reopen" }),
    ).toBeTruthy();
    expect(
      within(palette).queryByRole("button", { name: "Start Now" }),
    ).toBeNull();
  });
  it("persists collapse and keyboard resize preferences", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Collapse sidebar" }),
    );
    await screen.findByRole("button", { name: "Expand sidebar" });
    expect(data.settings.sidebar_collapsed).toBe(true);
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    const separator = await screen.findByRole("separator", {
      name: "Sidebar width",
    });
    separator.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(data.settings.sidebar_width).toBe(234));
  });
  it("uses the persisted profile in the pinned footer", async () => {
    data.settings.name = "Dim";
    data.settings.workspace = "Studio";
    const user = userEvent.setup();
    render(<App />);
    const summary = await screen.findByText("Dim", { selector: "strong" });
    expect(summary.closest(".profile-footer")).toBeTruthy();
    await user.click(summary);
    const menu = await screen.findByRole("menu", { name: "Profile menu" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((el) => el.textContent),
    ).toEqual(["Profile", "Appearance", "Settings", "Quit Reprise"]);
  });
  it("supports keyboard navigation of a task context menu", async () => {
    data.tasks = [closedTask("Dropped")];
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Dropped\s*1 items$/ }),
    );
    const card = screen.getByText("Dropped intention").closest("article")!;
    card.focus();
    await user.keyboard("{Shift>}{F10}{/Shift}");
    const menu = screen.getByRole("menu", {
      name: "Actions for Dropped intention",
    });
    expect(document.activeElement).toBe(
      within(menu).getAllByRole("menuitem")[0],
    );
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      within(menu).getByRole("menuitem", { name: "View History" }),
    );
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("menu", { name: "Actions for Dropped intention" }),
    ).toBeNull();
  });
});

it("offers Undo for a persisted transition and calls the guarded backend operation", async () => {
  data.tasks = [
    { ...closedTask("Dropped"), status: "Inbox", completed_at: null },
  ];
  let previous = data.tasks[0];
  const fallback = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation(async (cmd, args) => {
    if (cmd === "save_task") {
      previous = { ...data.tasks[0] };
      const saved = { ...args.task, updated_at: 300 };
      data.tasks = [saved];
      return saved;
    }
    if (cmd === "undo_task") {
      data.tasks = [previous];
      return previous;
    }
    return fallback(cmd, args);
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: /^Inbox\s*1 items$/ }),
  );
  await user.click(screen.getByRole("button", { name: "Start Now" }));
  await user.click(await screen.findByRole("button", { name: "Undo" }));
  expect(mocks.invoke).toHaveBeenCalledWith("undo_task", {
    id: "Dropped",
    revision: 300,
  });
  expect(data.tasks[0].status).toBe("Inbox");
});
it("defaults filtering to the current paused view and supports clearing", async () => {
  data.tasks = [
    {
      ...closedTask("Dropped"),
      id: "a",
      title: "Studio letter",
      status: "Settled",
      wake_at: Date.now() / 1000 + 999,
      settled_at: 100,
    },
    { ...closedTask("Finished"), id: "b", title: "Studio closed" },
  ];
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: /^Settled\s*1 items$/ }),
  );
  const search = screen.getByRole("textbox", { name: "Search tasks" });
  await user.type(search, "Studio");
  expect(screen.getByText("Studio letter")).toBeTruthy();
  expect(screen.queryByText("Studio closed")).toBeNull();
  await user.type(search, " missing");
  expect(screen.getByText("No matching tasks.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  expect((search as HTMLInputElement).value).toBe("");
});
it.each([
  "Inbox",
  "DoNow",
  "Scheduled",
  "Settled",
  "Snoozed",
  "Waiting",
  "Finished",
  "Dropped",
] as const)("opens a context menu in the %s view", async (status) => {
  data.tasks = [
    {
      ...closedTask("Dropped"),
      status,
      settled_at: 100,
      wake_at: 200,
      scheduled_at: 300,
    },
  ];
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", {
      name: new RegExp(`^${label(status)}\\s*1 items$`),
    }),
  );
  const card = screen.getByText("Dropped intention").closest("article")!;
  fireEvent.contextMenu(card, { clientX: 99999, clientY: 99999 });
  expect(
    screen.getByRole("menu", { name: "Actions for Dropped intention" }),
  ).toBeTruthy();
});

describe("Quick Capture regression", () => {
  it("supports the shared editing menu without losing its draft or closing capture on menu Escape", async () => {
    const user = userEvent.setup();
    render(<App captureMode />);
    const input = await screen.findByRole("textbox", {
      name: "Capture a task",
    });
    await user.type(input, "Capture draft");
    (input as HTMLInputElement).setSelectionRange(0, 7);
    fireEvent.contextMenu(input, { clientX: 450, clientY: 175 });
    const menu = screen.getByRole("menu", { name: "Text editing" });
    expect(within(menu).getByRole("menuitem", { name: "Copy" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("Capture draft");
    expect(mocks.hide).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });
  it("focuses capture, submits on Enter and hides only after success", async () => {
    const user = userEvent.setup();
    render(<App captureMode />);
    const input = screen.getByRole("textbox", { name: "Capture a task" });
    expect(document.activeElement).toBe(input);
    await user.type(input, "A captured intention{Enter}");
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("capture", {
        title: "A captured intention",
      }),
    );
    await waitFor(() => expect(mocks.hide).toHaveBeenCalled());
  });
  it("keeps the text and window open on a database error", async () => {
    const fallback = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "capture") throw Error("Could not save");
      return fallback(cmd, args);
    });
    const user = userEvent.setup();
    render(<App captureMode />);
    const input = screen.getByRole("textbox", { name: "Capture a task" });
    await user.type(input, "Keep this{Enter}");
    await screen.findByRole("alert");
    expect((input as HTMLInputElement).value).toBe("Keep this");
    expect(mocks.hide).not.toHaveBeenCalled();
  });
  it("keeps a draft when the borderless close button hides the window", async () => {
    const user = userEvent.setup();
    render(<App captureMode />);
    const input = screen.getByRole("textbox", { name: "Capture a task" });
    await user.type(input, "Keep this draft");
    await user.click(
      screen.getByRole("button", { name: "Close Quick Capture" }),
    );
    expect(mocks.hide).toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("Keep this draft");
    expect(mocks.invoke.mock.calls.some(([cmd]) => cmd === "capture")).toBe(
      false,
    );
  });
  it("saves once and stays visible while capture is pending", async () => {
    let resolveCapture: () => void = () => {};
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) =>
      cmd === "capture"
        ? new Promise<void>((resolve) => {
            resolveCapture = resolve;
          })
        : original(cmd, args),
    );
    const user = userEvent.setup();
    render(<App captureMode />);
    const input = screen.getByRole("textbox", { name: "Capture a task" });
    await user.type(input, "One intention");
    fireEvent.submit(input.closest("form")!);
    fireEvent.submit(input.closest("form")!);
    await user.keyboard("{Escape}");
    expect(mocks.hide).not.toHaveBeenCalled();
    expect(
      mocks.invoke.mock.calls.filter(([cmd]) => cmd === "capture"),
    ).toHaveLength(1);
    await act(async () => resolveCapture());
    await waitFor(() => expect(mocks.hide).toHaveBeenCalledOnce());
  });
  it("hides on Escape without creating a task", async () => {
    const user = userEvent.setup();
    render(<App captureMode />);
    await user.keyboard("{Escape}");
    expect(mocks.hide).toHaveBeenCalled();
    expect(mocks.invoke.mock.calls.some((c) => c[0] === "capture")).toBe(false);
  });
});

describe("personal sidebar navigation", () => {
  it("uses the new headings without changing destinations", async () => {
    render(<App />);
    const nav = await screen.findByRole("navigation");
    expect(
      within(nav)
        .getAllByRole("heading")
        .map((h) => h.textContent),
    ).toEqual(["General", "Tasks", "History"]);
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(expect.arrayContaining(["Home", "Inbox"]));
    expect(within(nav).queryByRole("button", { name: "Settings" })).toBeNull();
    expect(within(nav).queryByRole("heading", { name: "App" })).toBeNull();
  });
  it("collapses groups independently and keeps their state across remounts", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(await screen.findByRole("button", { name: "Tasks" }));
    await waitFor(() =>
      expect(data.settings.sidebar_groups?.tasks).toBe(false),
    );
    expect(
      within(screen.getByRole("navigation")).queryByRole("button", {
        name: /^Inbox/,
      }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /^Finished/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "History" }));
    await waitFor(() =>
      expect(data.settings.sidebar_groups?.history).toBe(false),
    );
    app.unmount();
    render(<App />);
    await screen.findByRole("navigation");
    expect(
      screen
        .getByRole("button", { name: "Tasks" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "General" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
  it("keeps every destination available in the rail and shows keyboard tooltips", async () => {
    data.settings.sidebar_collapsed = true;
    data.settings.sidebar_groups = { tasks: false, app: false };
    render(<App />);
    const nav = await screen.findByRole("navigation");
    const inbox = within(nav).getByRole("button", { name: /^Inbox/ });
    const user = userEvent.setup();
    for (let i = 0; i < 30 && document.activeElement !== inbox; i++)
      await user.tab();
    expect(document.activeElement).toBe(inbox);
    expect(screen.getByRole("tooltip").textContent).toBe("Inbox");
    expect(inbox.getAttribute("aria-describedby")).toBe("sidebar-tooltip");
    expect(within(nav).queryByRole("button", { name: "Settings" })).toBeNull();
  });
  it("preserves the preferred expanded width across collapse and expand", async () => {
    data.settings.sidebar_width = 292;
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Collapse sidebar" }),
    );
    await screen.findByRole("button", { name: "Expand sidebar" });
    expect(screen.getByRole("complementary").getAttribute("style")).toContain(
      "64px",
    );
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    await waitFor(() =>
      expect(screen.getByRole("complementary").getAttribute("style")).toContain(
        "292px",
      ),
    );
  });
  it("uses Space name in Settings and updates the footer after save", async () => {
    data.settings.workspace = "";
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    expect(screen.getByText("Personal", { selector: "small" })).toBeTruthy();
    await openSettings(user);
    expect(screen.getByRole("heading", { name: "Your space" })).toBeTruthy();
    await user.type(
      screen.getByRole("textbox", { name: "Space name" }),
      "Quiet studio",
    );
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() =>
      expect(
        screen.getByText("Quiet studio", { selector: "small" }),
      ).toBeTruthy(),
    );
    expect(data.settings.workspace).toBe("Quiet studio");
  });
  it("executes group context actions and supports keyboard invocation", async () => {
    const user = userEvent.setup();
    render(<App />);
    const tasks = await screen.findByRole("button", {
      name: "Tasks",
    });
    tasks.focus();
    await user.keyboard("{Shift>}{F10}{/Shift}");
    const menu = screen.getByRole("menu", { name: "Sidebar actions" });
    await user.click(
      within(menu).getByRole("menuitem", { name: "Show only Tasks" }),
    );
    await waitFor(() =>
      expect(data.settings.sidebar_groups).toEqual({
        general: false,
        tasks: true,
        history: false,
      }),
    );
    fireEvent.contextMenu(tasks);
    await user.click(
      screen.getByRole("menuitem", { name: "Expand all groups" }),
    );
    await waitFor(() =>
      expect(data.settings.sidebar_groups).toEqual({
        general: true,
        tasks: true,
        history: true,
      }),
    );
  });
});

describe("right notification panel", () => {
  it.each([
    ["UpdateCurrent", "You're up to date"],
    ["UpdateNotConfigured", "Updates aren't connected yet"],
  ])(
    "shows %s check results in persisted in-app history",
    async (state, title) => {
      const original = mocks.invoke.getMockImplementation()!;
      mocks.invoke.mockImplementation(async (cmd, args) => {
        if (cmd === "check_updates") {
          data.notifications = [
            {
              id: "update:check:one",
              task_id: null,
              category: "Updates",
              title,
              message: "Update check result",
              created_at: 100,
              scheduled_at: 100,
              submitted_at: null,
              state,
              read: false,
            },
          ];
          return { notice_id: "update:check:one" };
        }
        return original(cmd, args);
      });
      const user = userEvent.setup();
      render(<App />);
      await openSettings(user);
      expect(mocks.invoke).not.toHaveBeenCalledWith("check_updates");
      await user.click(
        screen.getByRole("button", { name: "Check for updates" }),
      );
      const panel = await screen.findByRole("complementary", {
        name: "Notifications",
      });
      expect(within(panel).getByText(title)).toBeTruthy();
      expect(
        within(panel).queryByRole("button", { name: /Update Reprise to/ }),
      ).toBeNull();
      expect(data.notifications[0].submitted_at).toBeNull();
    },
  );
  it("protects unsaved Settings before restarting for an update", async () => {
    data.notifications = [
      {
        id: "update:available:3.4.0",
        task_id: null,
        category: "Updates",
        title: "Reprise v3.4.0 is available",
        message: "Click to update",
        created_at: 100,
        scheduled_at: 100,
        submitted_at: null,
        state: "UpdateAvailable",
        read: false,
      },
    ];
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.type(screen.getByLabelText("Display name"), " edited");
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    const update = await screen.findByRole("button", {
      name: "Update Reprise to v3.4.0",
    });
    await user.click(update);
    let dialog = await screen.findByRole("dialog", {
      name: "Save your Settings changes?",
    });
    expect(
      mocks.invoke.mock.calls.some(([cmd]) => cmd === "install_update"),
    ).toBe(false);
    await user.click(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    );
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Test edited");
    await user.click(update);
    dialog = await screen.findByRole("dialog", {
      name: "Save your Settings changes?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Save and continue" }),
    );
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("install_update", {
        noticeId: "update:available:3.4.0",
      }),
    );
    expect(data.settings.name).toBe("Test edited");
  });
  it("installs from the update notification and exposes download errors for retry", async () => {
    let rejectInstall: (error: Error) => void = () => {};
    const original = mocks.invoke.getMockImplementation()!;
    mocks.invoke.mockImplementation(async (cmd, args) => {
      if (cmd === "check_updates") {
        data.notifications = [
          {
            id: "update:available:3.2.0",
            task_id: null,
            category: "Updates",
            title: "Reprise v3.2.0 is available",
            message: "Click to update",
            created_at: 100,
            scheduled_at: 100,
            submitted_at: null,
            state: "UpdateAvailable",
            read: false,
          },
        ];
        return { notice_id: data.notifications[0].id };
      }
      if (cmd === "install_update")
        return new Promise((_, reject) => {
          rejectInstall = reject;
        });
      return original(cmd, args);
    });
    const user = userEvent.setup();
    render(<App />);
    await openSettings(user);
    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    await user.click(
      await screen.findByRole("button", { name: "Update Reprise to v3.2.0" }),
    );
    expect(mocks.invoke).toHaveBeenCalledWith("install_update", {
      noticeId: "update:available:3.2.0",
    });
    act(() =>
      mocks.listeners.get("update-progress")!({
        payload: {
          notice_id: "update:available:3.2.0",
          stage: "downloading",
          downloaded: 75,
          total: 100,
        },
      }),
    );
    expect(
      screen.getByRole("status", { name: "Update progress" }).textContent,
    ).toContain("75%");
    act(() => rejectInstall(new Error("Signature verification failed")));
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Update progress" }).textContent,
      ).toContain("Signature verification failed"),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Update Reprise to v3.2.0",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("removes redundant toolbar controls while retaining keyboard access", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    expect(
      screen.queryByRole("button", { name: "Open notifications" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open command palette" }),
    ).toBeNull();
    await user.keyboard("{Control>}k{/Control}");
    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Close command palette" }),
    );
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    expect(
      screen.getByRole("complementary", { name: "Notifications" }),
    ).toBeTruthy();
  });
  it("finishes exit motion before unmounting and cancels it safely when reopened", async () => {
    const focused = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    await user.click(
      screen.getByRole("button", { name: "Close notifications" }),
    );
    const exiting = document.querySelector(".notification-dock")!;
    expect(exiting.getAttribute("data-exiting")).toBe("true");
    expect(exiting.hasAttribute("inert")).toBe(true);
    expect(document.activeElement?.tagName).toBe("MAIN");
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    expect(
      screen
        .getByRole("complementary", { name: "Notifications" })
        .getAttribute("data-exiting"),
    ).toBe("false");
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(
      screen.getByRole("complementary", { name: "Notifications" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Close notifications" }),
    );
    await waitFor(() =>
      expect(document.querySelector(".notification-dock")).toBeNull(),
    );
    focused.mockRestore();
  });
  it("closes immediately with decorative motion disabled", async () => {
    data.settings.animation = "off";
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    await user.click(
      screen.getByRole("button", { name: "Close notifications" }),
    );
    expect(document.querySelector(".notification-dock")).toBeNull();
  });
  it("reveals at the right edge, tucks away after leaving, and ignores open dialogs", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Reveal notifications" });
    expect(
      screen.queryByRole("complementary", { name: "Notifications" }),
    ).toBeNull();
    fireEvent(
      window,
      new MouseEvent("pointermove", { clientX: innerWidth - 1 }),
    );
    const panel = await screen.findByRole("complementary", {
      name: "Notifications",
    });
    fireEvent.pointerLeave(panel, { pointerType: "mouse" });
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "Notifications" }),
      ).toBeNull(),
    );
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");
    fireEvent(window, new MouseEvent("pointermove", { clientX: 0 }));
    fireEvent(
      window,
      new MouseEvent("pointermove", { clientX: innerWidth - 1 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(
      screen.queryByRole("complementary", { name: "Notifications" }),
    ).toBeNull();
  });
  it("persists pinning across remounts and unpins without losing history", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await screen.findByRole("navigation");
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    await user.click(screen.getByRole("button", { name: "Pin notifications" }));
    await waitFor(() =>
      expect(data.settings.notification_panel_pinned).toBe(true),
    );
    fireEvent.pointerLeave(
      screen.getByRole("complementary", { name: "Notifications" }),
    );
    expect(
      screen
        .getByRole("complementary", { name: "Notifications" })
        .getAttribute("data-pinned"),
    ).toBe("true");
    app.unmount();
    render(<App />);
    await screen.findByRole("button", { name: "Unpin notifications" });
    await user.click(
      screen.getByRole("button", { name: "Unpin notifications" }),
    );
    await waitFor(() =>
      expect(data.settings.notification_panel_pinned).toBe(false),
    );
    await user.click(
      screen.getByRole("button", { name: "Close notifications" }),
    );
    expect(
      screen.queryByRole("complementary", { name: "Notifications" }),
    ).toBeNull();
  });
  it("uses persisted records for filters, marking read and task details", async () => {
    data.tasks = [closedTask("Finished")];
    data.notifications = [
      {
        id: "notice-one",
        task_id: data.tasks[0].id,
        category: "Settled",
        title: "Return to the plan",
        message: "Ready for review",
        created_at: 100,
        scheduled_at: 99,
        submitted_at: 100,
        state: "Submitted",
        read: false,
      },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    const panel = screen.getByRole("complementary", { name: "Notifications" });
    expect(within(panel).queryByText("Submitted")).toBeNull();
    await user.type(
      within(panel).getByRole("searchbox", { name: "Search notifications" }),
      "absent",
    );
    expect(within(panel).getByText("No matching reminders.")).toBeTruthy();
    await user.clear(
      within(panel).getByRole("searchbox", { name: "Search notifications" }),
    );
    await user.click(within(panel).getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(data.notifications[0].read).toBe(true));
    expect(data.notifications[0].state).toBe("Submitted");
    await user.click(
      within(panel).getByRole("checkbox", { name: "Unread only" }),
    );
    expect(within(panel).queryByText("Return to the plan")).toBeNull();
    await user.click(
      within(panel).getByRole("checkbox", { name: "Unread only" }),
    );
    await user.click(within(panel).getByRole("button", { name: "Open task" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(data.notifications).toHaveLength(1);
  });
  it("opens from the palette without leaving the current task view and closes by keyboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    await user.keyboard("{Control>}k{/Control}");
    await user.type(
      screen.getByRole("textbox", { name: "Global task and command search" }),
      "Notifications",
    );
    await user.click(
      screen.getByRole("button", { name: "Go to Notifications" }),
    );
    await screen.findByRole("complementary", { name: "Notifications" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Test",
    );
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("notification-panel"),
    );
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("complementary", { name: "Notifications" }),
    ).toBeNull();
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    expect(
      await screen.findByRole("complementary", { name: "Notifications" }),
    ).toBeTruthy();
  });
});

describe("semantic task presentation", () => {
  it("renames Notifications consistently without changing the route", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("navigation");
    await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}");
    expect(
      screen.getByRole("heading", { name: /Notifications/, level: 2 }),
    ).toBeTruthy();
    expect(screen.getByText("Waitin' for ya")).toBeTruthy();
    expect(commandDestinations).toContain("Notification History");
    expect(navigation.flatMap((g) => g.items)).not.toContain(
      "Notification History",
    );
  });
  it("renders only positive sidebar counts and omits badge elements in the icon rail", async () => {
    data.tasks = [closedTask("Dropped")];
    const user = userEvent.setup();
    render(<App />);
    const nav = await screen.findByRole("navigation");
    const dropped = within(nav).getByRole("button", {
      name: /^Dropped\s*1 items$/,
    });
    expect(dropped.querySelector(".nav-count")?.textContent).toBe("1");
    expect(
      within(nav)
        .getByRole("button", { name: "Inbox" })
        .querySelector(".nav-count"),
    ).toBeNull();
    await user.click(dropped);
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(nav.querySelector(".nav-count")).toBeNull();
  });
  it("marks only task sidebar icons/counts with semantic categories", async () => {
    render(<App />);
    const nav = await screen.findByRole("navigation");
    for (const category of [
      "Inbox",
      "DoNow",
      "Scheduled",
      "Settled",
      "Snoozed",
      "Waiting",
      "Resurfaced",
      "Finished",
      "Dropped",
    ]) {
      const button = within(nav).getByRole("button", {
        name: new RegExp(`^${label(category)}$`),
      });
      expect(button.getAttribute("data-status")).toBe(category);
      expect(button.querySelector("svg")).toBeTruthy();
      expect(button.querySelector(".nav-count")).toBeNull();
    }
    for (const name of ["Home", "Daily Review", "All Tasks"])
      expect(
        within(nav)
          .getByRole("button", {
            name: new RegExp(`^${label(name)}(?:\\s*0 items)?$`),
          })
          .hasAttribute("data-status"),
      ).toBe(false);
  });
  it("keeps lifecycle and review color indicators separate", async () => {
    data.tasks = [
      {
        ...closedTask("Dropped"),
        status: "Settled",
        settled_at: 100,
        review_at: 200,
        review_reason: "Settled reminder",
      },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /^Resurfaced\s*1 items$/ }),
    );
    const card = screen.getByText("Dropped intention").closest("article")!;
    expect(card.getAttribute("data-status")).toBe("Settled");
    expect(card.querySelector(".status")?.getAttribute("data-status")).toBe(
      "Settled",
    );
    expect(
      card.querySelector(".queue-indicator")?.getAttribute("data-status"),
    ).toBe("Resurfaced");
    expect(card.querySelector(".queue-indicator")?.textContent).toContain(
      "Resurfaced",
    );
    expect(data.tasks[0].status).toBe("Settled");
  });
});
