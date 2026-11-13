// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DateTimeField, validLocalValue } from "./DateTimeField";
afterEach(cleanup);
it("accepts human dates without rewriting an entry mid-typing and preserves canonical local values", async () => {
  const user = userEvent.setup();
  function Example() {
    const [value, setValue] = useState("2026-11-13T12:34");
    return (
      <>
        <DateTimeField
          aria-label="Scheduled start"
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <output>{value}</output>
        <button>Leave field</button>
      </>
    );
  }
  render(<Example />);
  const field = screen.getByRole("textbox", { name: "Scheduled start" });
  await user.clear(field);
  await user.type(field, "march 3rd, 2027 at 2:30pm");
  expect((field as HTMLInputElement).value).toBe("march 3rd, 2027 at 2:30pm");
  expect(screen.getByRole("status").textContent).toBe("2027-03-03T14:30");
  await user.click(screen.getByRole("button", { name: "Leave field" }));
  expect((field as HTMLInputElement).value).toBe("March 3, 2027 at 2:30 PM");
  await user.clear(field);
  await user.type(field, "march 4th, 2027");
  await user.tab();
  expect(screen.getByRole("status").textContent).toBe("2027-03-04T14:30");
  expect((field as HTMLInputElement).value).toBe("March 4, 2027 at 2:30 PM");
});
it("allows replacing the calendar year and retains invalid partial text without emitting a timestamp", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <label>
      Deadline
      <DateTimeField
        type="datetime-local"
        value="2026-11-13T12:00"
        onChange={change}
      />
    </label>,
  );
  await user.click(
    screen.getByRole("button", { name: "Choose date and time" }),
  );
  await user.clear(screen.getByLabelText("Calendar year"));
  await user.type(screen.getByLabelText("Calendar year"), "2030");
  await user.click(screen.getByLabelText("Time (24-hour)"));
  expect(
    screen.getByRole("button", { name: "November 13, 2030" }),
  ).toBeTruthy();
  await user.keyboard("{Escape}");
  await user.clear(screen.getByLabelText("Deadline"));
  change.mockClear();
  await user.type(screen.getByLabelText("Deadline"), "2026-");
  expect(change).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Deadline") as HTMLInputElement).value).toBe(
    "2026-",
  );
});
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
