import { taskActions, type ActionId } from "./taskActions";
import type { Task } from "./model";
import { PopupMenu } from "./PopupMenu";
import type { TaskCategory } from "./taskColors";
export const actionCategory: Partial<Record<ActionId, TaskCategory>> = {
  start: "DoNow",
  surface: "Resurfaced",
  schedule: "Scheduled",
  snooze: "Snoozed",
  return: "Settled",
  followup: "Waiting",
  settle: "Settled",
  inbox: "Inbox",
  finish: "Finished",
  drop: "Dropped",
  review: "Resurfaced",
};
export function TaskMenu({
  task,
  x,
  y,
  onClose,
  onAction,
}: {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
  onAction: (id: ActionId) => void;
}) {
  return (
    <PopupMenu
      label={`Actions for ${task.title}`}
      x={x}
      y={y}
      onClose={onClose}
      actions={taskActions(task).map((a) => ({
        ...a,
        danger: a.id === "delete",
        category: actionCategory[a.id],
        onSelect: () => onAction(a.id),
      }))}
    />
  );
}
