// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { DateTimeField, validLocalValue } from "./DateTimeField";
afterEach(cleanup);
it("validates calendar dates and accepts exact minute values", () => {
  expect(validLocalValue("2028-02-29T00:00", "datetime-local")).toBe(true);
  expect(validLocalValue("2027-02-29T12:00", "datetime-local")).toBe(false);
  expect(validLocalValue("2026-04-31T12:00", "datetime-local")).toBe(false);
  expect(validLocalValue("23:59", "time")).toBe(true);
  expect(validLocalValue("24:00", "time")).toBe(false);
});
it("does not change a date until Apply and preserves it on Escape", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <label>
      Scheduled start
      <DateTimeField
        type="datetime-local"
        value="2026-11-13T12:34"
        onChange={change}
      />
    </label>,
  );
  await user.click(
    screen.getByRole("button", { name: "Choose date and time" }),
  );
  await user.click(screen.getByRole("button", { name: "November 14, 2026" }));
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Apply" }));
  expect(change).toHaveBeenCalledWith({
    target: { value: "2026-11-14T12:34" },
  });
  change.mockClear();
  await user.click(
    screen.getByRole("button", { name: "Choose date and time" }),
  );
  await user.keyboard("{Escape}");
  expect(change).not.toHaveBeenCalled();
});
it("keeps the picker open for invalid or earlier times", async () => {
  const user = userEvent.setup();
  render(
    <DateTimeField
      type="time"
      value="12:30"
      min="12:00"
      required
      onChange={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Choose time" }));
  await user.clear(screen.getByLabelText("Time (24-hour)"));
  await user.type(screen.getByLabelText("Time (24-hour)"), "09:00");
  expect(
    (screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
