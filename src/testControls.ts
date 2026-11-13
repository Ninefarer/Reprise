import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
export async function selectOption(user: ReturnType<typeof userEvent.setup>, control: HTMLElement, value: string) {
  await user.click(control);
  const option = screen.getAllByRole("option").find(node => node.getAttribute("data-value") === value);
  if (!option) throw Error(`No option ${value}`);
  await user.click(option);
}
