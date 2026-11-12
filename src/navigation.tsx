import type { View } from "./model";
const paths: Record<string, string> = {
  Home: "m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8",
  "Daily Review": "M8 3h8v4H8z M8 5H5v16h14V5h-3 M8 12l2 2 5-5 M8 18h8",
  Inbox: "M4 4h16v16H4z M4 13h5l1 3h4l1-3h5",
  DoNow: "m9 5 11 7-11 7z",
  Scheduled: "M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16",
  Settled: "M8 4v16 M16 4v16",
  Snoozed: "M12 3a9 9 0 1 0 9 9 M12 7v6l4 2 M16 3h5l-5 5h5",
  Waiting: "M6 3h12 M6 21h12 M7 3c0 6 10 12 10 18 M17 3c0 6-10 12-10 18",
  Resurfaced: "M4 10a8 8 0 1 1 0 5 M4 4v6h6",
  "All Tasks": "M8 5h13 M8 12h13 M8 19h13 M3 5h1 M3 12h1 M3 19h1",
  Finished: "m5 12 4 4 10-10",
  Dropped: "M6 6l12 12 M18 6 6 18",
  "Notification History": "M5 16h14l-2-4V8a5 5 0 0 0-10 0v4z M10 20h4",
  Settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
};
export function Icon({ name }: { name: View }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export type NavigationGroup = "general" | "tasks" | "history" | "app";
export const navigation: {
  id: NavigationGroup;
  title: string;
  items: View[];
}[] = [
  { id: "general", title: "General", items: ["Home", "Daily Review"] },
  {
    id: "tasks",
    title: "Tasks",
    items: [
      "Inbox",
      "DoNow",
      "Scheduled",
      "Settled",
      "Snoozed",
      "Waiting",
      "Resurfaced",
    ],
  },
  {
    id: "history",
    title: "History",
    items: ["All Tasks", "Finished", "Dropped"],
  },
];
// Utility destinations stay searchable even though they do not live in the left rail.
export const commandDestinations: View[] = [
  ...navigation.flatMap((group) => group.items),
  "Notification History",
  "Settings",
];
