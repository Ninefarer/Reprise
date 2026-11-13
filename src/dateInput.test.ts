import { expect, it } from "vitest";
import { parseDateInput, displayDateInput, parseClock } from "./dateInput";
it("accepts readable month names, ordinal dates and optional times without guessing ambiguous dates", () => {
  expect(parseDateInput("march 3rd, 2027", "datetime-local")).toBe(
    "2027-03-03T09:00",
  );
  expect(parseDateInput("March 3, 2027 at 2:30 pm", "datetime-local")).toBe(
    "2027-03-03T14:30",
  );
  expect(parseDateInput("3 March 2027 14:30", "datetime-local")).toBe(
    "2027-03-03T14:30",
  );
  expect(parseDateInput("2027-03-03T14:30", "datetime-local")).toBe(
    "2027-03-03T14:30",
  );
  expect(
    parseDateInput("March 3, 2027", "datetime-local", "2026-11-13T17:42"),
  ).toBe("2027-03-03T17:42");
  for (const text of [
    "03/04/2027",
    "February 29, 2027",
    "April 31, 2027",
    "March 3 2027 at 24:00",
    "March 3rd",
    "today",
  ])
    expect(parseDateInput(text, "datetime-local")).toBeNull();
});
it("formats stored wall times readably and round-trips midnight and noon", () => {
  for (const value of [
    "2027-03-03T00:00",
    "2027-03-03T12:00",
    "2027-03-03T23:59",
  ])
    expect(
      parseDateInput(
        displayDateInput(value, "datetime-local"),
        "datetime-local",
      ),
    ).toBe(value);
  expect(displayDateInput("2027-03-03T14:30", "datetime-local")).toBe(
    "March 3, 2027 at 2:30 PM",
  );
  expect(parseClock("12am")).toBe("00:00");
  expect(parseClock("12pm")).toBe("12:00");
  expect(parseClock("9:05 p.m.")).toBe("21:05");
  expect(parseClock("24:00")).toBeNull();
});
