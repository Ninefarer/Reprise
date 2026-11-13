import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
export async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
  value: string,
) {
  const panel = control.closest<HTMLElement>("[data-settings-panel]");
  if (panel?.hidden)
    await user.click(
      screen.getByRole("tab", { name: panel.dataset.settingsPanel }),
    );
  await user.click(control);
  const option = screen
    .getAllByRole("option")
    .find((node) => node.getAttribute("data-value") === value);
  if (!option) throw Error(`No option ${value}`);
  await user.click(option);
}
