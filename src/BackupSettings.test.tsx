// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { BackupSettings } from "./BackupSettings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("browses backups and requires confirmation before replacement", async () => {
  const path = "C:/Backups/external.reprise-backup";
  vi.mocked(open).mockResolvedValue(path);
  vi.mocked(invoke)
    .mockResolvedValueOnce([])
    .mockRejectedValue("Invalid backup; live data unchanged");
  render(<BackupSettings />);
  fireEvent.click(screen.getByRole("button", { name: "Browse backups" }));
  await screen.findByText("external.reprise-backup");
  fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
  expect(invoke).not.toHaveBeenCalledWith("restore_backup", { path });
  expect(screen.getByRole("alert").textContent).toContain(
    "Unsaved drafts will be discarded",
  );
  fireEvent.click(screen.getByRole("button", { name: "Restore and restart" }));
  await screen.findByText("Invalid backup; live data unchanged");
  expect(invoke).toHaveBeenCalledWith("restore_backup", { path });
});

it("creates a local backup and uses Save As for Takeout", async () => {
  const path = "C:/Exports/reprise.REPRISE-BACKUP";
  vi.mocked(save).mockResolvedValue(path);
  vi.mocked(invoke).mockImplementation(async (command) =>
    command === "list_backups" ? [] : "Backup saved",
  );
  render(<BackupSettings />);
  fireEvent.click(screen.getByRole("button", { name: "Create backup" }));
  await screen.findByText("Backup saved");
  expect(invoke).toHaveBeenCalledWith("create_backup", {});
  fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("create_backup", { path }),
  );
});

it("distinguishes backups with the same timestamp by filename", async () => {
  const first = "morning.reprise-backup";
  const second = "before-edit.reprise-backup";
  const modified = 1_800_000_000;
  const path = `C:/Backups/${second}`;
  vi.mocked(invoke).mockResolvedValueOnce([
    { path: `C:/Backups/${first}`, name: first, modified },
    { path, name: second, modified },
  ]);
  render(<BackupSettings />);
  await screen.findByText("Choose a backup");
  const picker = screen.getByRole<HTMLButtonElement>("combobox");
  fireEvent.click(picker);
  expect(
    screen.getByRole("option", { name: /morning\.reprise-backup/ }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("option", { name: /before-edit\.reprise-backup/ }),
  );
  expect(picker.value).toBe(path);
});
