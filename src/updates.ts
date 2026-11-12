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
    return activity.message || "The update couldn't finish. Try again.";
  if (activity.stage === "checking") return "Checking this update…";
  if (activity.stage === "verifying") return "Verifying the update…";
  if (activity.stage === "installing")
    return "Installing. Reprise will restart…";
  if (activity.total && activity.total > 0)
    return `Downloading… ${Math.min(100, Math.floor((activity.downloaded / activity.total) * 100))}%`;
  return "Downloading the update…";
}
