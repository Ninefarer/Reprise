// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDialog } from "./TaskDialog";
import type { Task } from "./model";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);
const original: Task = {
  id: "draft-regression",
  title: "Original title",
  description: "Original notes",
  status: "Inbox",
  priority: 0,
  energy: "",
  created_at: 100,
  updated_at: 200,
  scheduled_at: null,
  due_at: null,
  wake_at: null,
  completed_at: null,
  project: "",
  tags: "",
  recurrence: "",
  reason: "",
  review_at: null,
  review_reason: null,
  parent_task_id: null,
};
it.each([
  ["Do now", "DoNow"],
  ["Settle", "Settled"],
  ["Finish", "Finished"],
] as const)(
  "%s submits the edited task rather than silently discarding its draft",
  async (name, status) => {
    const user = userEvent.setup();
    const onTransition = vi.fn(async () => true),
      onClose = vi.fn();
    render(
      <TaskDialog
        task={original}
        intent="edit"
        onTransition={onTransition}
        onClose={onClose}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Edited title");
    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "Keep these notes");
    await user.type(screen.getByLabelText("Project"), "Personal");
<<<<<<< HEAD
    await user.click(screen.getByRole("button", { name, exact: true }));
=======
    await user.click(screen.getByRole("button", { name }));
>>>>>>> main
    expect(onTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Edited title",
        description: "Keep these notes",
        project: "Personal",
        updated_at: 200,
      }),
      status,
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(original.title).toBe("Original title");
  },
);
it("keeps edited values available when a transition is rejected", async () => {
  const user = userEvent.setup(),
    onClose = vi.fn();
  render(
    <TaskDialog
      task={original}
      intent="edit"
      onTransition={vi.fn(async () => false)}
      onClose={onClose}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      externalError="This task changed elsewhere."
    />,
  );
  await user.type(screen.getByLabelText("Notes"), " Keep this edit");
<<<<<<< HEAD
  await user.click(screen.getByRole("button", { name: "Finish", exact: true }));
=======
  await user.click(screen.getByRole("button", { name: "Finish" }));
>>>>>>> main
  expect(onClose).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe(
    "Original notes Keep this edit",
  );
  expect(screen.getByRole("alert").textContent).toContain("changed elsewhere");
});
