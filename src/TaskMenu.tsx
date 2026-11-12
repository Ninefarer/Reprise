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
  request,
  x,
  y,
  onClose,
  onAction,
}: {
  task: Task;
  request?: object;
  x: number;
  y: number;
  onClose: () => void;
  onAction: (id: ActionId) => void;
}) {
  return (
    <PopupMenu
      label={`Actions for ${task.title}`}
      request={request}
      x={x}
      y={y}
      onClose={onClose}
      actions={taskActions(task).map((a) => ({
        ...a,
        danger: a.id === "delete",
        separatorBefore:
          a.id === "edit" || a.id === "history" || a.id === "delete",
        category: actionCategory[a.id],
        onSelect: () => onAction(a.id),
      }))}
    />
  );
}
