import type { ReactNode } from "react";
const paths: Record<string, string> = {
  start: "m7 4 10 6-10 6Z",
  open: "m8 4 6 6-6 6",
  review: "m8 4 6 6-6 6",
  resume: "M5 9h10M10 4 5 9l5 5",
  surface: "M4 8a6 6 0 1 1 0 5M4 3v5h5",
  schedule: "M4 5h12v12H4ZM7 3v4m6-4v4M4 9h12",
  followup: "M4 5h12v12H4ZM7 3v4m6-4v4M4 9h12",
  snooze:
    "M6 2 2 6m12-4 4 4M6 17l-2 2m10-2 2 2M10 6v5l3 2M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  return: "M10 3a7 7 0 1 0 7 7 7 7 0 0 0-7-7Zm0 3v4l3 2",
  settle: "M7 4v12m6-12v12",
  inbox: "M3 5h14v11H3Zm0 6h4l1 2h4l1-2h4",
  finish: "m4 10 4 4 8-8",
  drop: "m5 5 10 10M15 5 5 15",
  edit: "m4 13 9-9 3 3-9 9H4Zm7-7 3 3",
  history: "M5 5h11M5 10h11M5 15h11",
  delete: "M3 5h14M8 3h4M5 5l1 12h8l1-12M8 8v6m4-6v6",
  cut: "m8 8 8 8M8 12l8-8M6 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  copy: "M7 7h10v10H7ZM13 7V3H3v10h4",
  paste: "M7 4H4v13h12V4h-3M7 2h6v4H7Z",
  selectAll: "M3 7V3h4m6 0h4v4m0 6v4h-4M7 17H3v-4M7 7h6v6H7Z",
  undo: "M7 4 3 8l4 4M3 8h9a4 4 0 0 1 0 8",
  redo: "m13 4 4 4-4 4M17 8H8a4 4 0 0 0 0 8",
  group: "m5 7 5 5 5-5",
  only: "M3 5h14M6 10h8M8 15h4",
  "expand-all": "m6 7 4-4 4 4m-8 6 4 4 4-4",
  "collapse-all": "m6 3 4 4 4-4m-8 14 4-4 4 4",
  sidebar: "M3 4h14v12H3Zm5 0v12",
  "reset-width": "M3 4h14v12H3ZM8 4v12m3-6h4",
};
export function MenuGlyph({
  id,
  fallback,
}: {
  id: string;
  fallback?: ReactNode;
}) {
  return paths[id] ? (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[id]} />
    </svg>
  ) : (
    <>{fallback}</>
  );
}
