// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";
afterEach(cleanup);
it("opens at the selected value, skips disabled choices and restores focus", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <label>
      Mode
      <Select value="b" onChange={change}>
        <option value="a" disabled>
          Alpha
        </option>
        <option value="b">Beta</option>
        <option value="c">Charlie</option>
      </Select>
    </label>,
  );
  const trigger = screen.getByRole("combobox", { name: "Mode" });
  await user.click(trigger);
  expect(document.activeElement?.textContent).toContain("Beta");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(change).toHaveBeenCalledWith({ target: { value: "c" } });
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("cancels a choice with Escape and supports type-ahead", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <label>
      Mode
      <Select value="a" onChange={change}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    </label>,
  );
  await user.click(screen.getByRole("combobox"));
  await user.keyboard("b");
  expect(document.activeElement?.textContent).toContain("Beta");
  await user.keyboard("{Escape}");
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe(
    "false",
  );
});
