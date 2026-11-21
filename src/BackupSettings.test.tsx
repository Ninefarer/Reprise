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
import { BackupSettings } from "./BackupSettings";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("requires confirmation for replacement and displays backend failures", async () => {
  vi.mocked(invoke).mockRejectedValue("Invalid backup; live data unchanged");
  render(<BackupSettings />);
  fireEvent.change(screen.getByLabelText("Backup file"), {
    target: { value: "C:\\tasks.reprise-backup" },
  });
  fireEvent.click(screen.getByText("Restore backup"));
  expect(invoke).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain(
    "Unsaved drafts will be discarded",
  );
  fireEvent.click(screen.getByText("Restore and restart"));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("Invalid backup"),
  );
  expect(invoke).toHaveBeenCalledWith("restore_backup", {
    path: "C:\\tasks.reprise-backup",
  });
});
