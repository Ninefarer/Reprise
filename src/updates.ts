import type { Notice } from "./model";
export interface UpdateActivity {
  notice_id: string;
  stage: "checking" | "downloading" | "verifying" | "installing" | "error";
  downloaded: number;
  total: number | null;
  message?: string;
}
export function offeredVersion(notice: Notice): string | null {
  if (
    notice.category !== "Updates" ||
    !["UpdateAvailable", "UpdateError"].includes(notice.state) ||
    !notice.id.startsWith("update:available:")
  )
    return null;
  return notice.id.slice("update:available:".length);
}
export function updateMessage(activity: UpdateActivity): string {
  if (activity.stage === "error")
    return friendlyUpdateError(activity.message, "install");
  if (activity.stage === "checking") return "Checking this update…";
  if (activity.stage === "verifying") return "Verifying the update…";
  if (activity.stage === "installing")
    return "Installing. Reprise will restart…";
  if (activity.total && activity.total > 0)
    return `Downloading… ${Math.min(100, Math.floor((activity.downloaded / activity.total) * 100))}%`;
  return "Downloading the update…";
}

/** Technical details stay in diagnostics, never in everyday update feedback. */
export function friendlyUpdateError(
  error: unknown,
  action: "check" | "install" = "check",
): string {
  const detail = String(error ?? "").toLowerCase();
  if (
    /signature|signed version|verification|verif|checksum|tamper/.test(detail)
  )
    return "This download couldn't be verified. Nothing was installed. Check for updates and try again.";
  if (
    /offline|network|dns|connect|request|fetch|resolve|timed? ?out|socket|tls|certificate/.test(
      detail,
    )
  )
    return "Couldn't reach the update service. Check your internet connection and try again.";
  if (/already|in progress|running/.test(detail))
    return "An update is already running. Wait for it to finish, then try again.";
  return action === "install"
    ? "The update couldn't finish. Try again from Notifications."
    : "Couldn't check for updates. Try again later.";
}
