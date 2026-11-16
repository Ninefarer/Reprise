import { useEffect, useState, type ComponentType } from "react";

/** Loads backup controls only for the Nightly web build. */
export function WebBackupSlot() {
  const [View, setView] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (import.meta.env.MODE !== "web") return;
    let live = true;
    void import("./WebBackup").then((mod) => {
      if (live) setView(() => mod.WebBackup);
    });
    return () => {
      live = false;
    };
  }, []);
  if (import.meta.env.MODE !== "web" || !View) return null;
  return <View />;
}
