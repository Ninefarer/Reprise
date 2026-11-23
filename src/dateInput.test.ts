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

it("accepts relative dates, weekdays, yearless names and unambiguous numeric dates", () => {
  const now = new Date(2026, 10, 23, 10, 15);
  const parse = (text: string) =>
    parseDateInput(text, "datetime-local", "", now);
  expect(parse("tomorrow at 2pm")).toBe("2026-11-24T14:00");
  expect(parse("Friday 14:30")).toBe("2026-11-27T14:30");
  expect(parse("next Monday at noon")).toBe("2026-11-30T12:00");
  expect(parse("today @ noon")).toBe("2026-11-23T12:00");
  expect(parse("tomorrow@2pm")).toBe("2026-11-24T14:00");
  expect(parse("today at midnight")).toBe("2026-11-23T00:00");
  expect(parse("in 2 hours")).toBe("2026-11-23T12:15");
  expect(parse("in 30 minutes")).toBe("2026-11-23T10:45");
  expect(parse("in 2 days")).toBe("2026-11-25T10:15");
  expect(parse("March 23 at 9am")).toBe("2026-03-23T09:00");
  expect(parse("3/23/2027 2pm")).toBe("2027-03-23T14:00");
  expect(parse("23/3/2027")).toBe("2027-03-23T09:00");
  expect(parse("03/04/2027")).toBeNull();
  expect(parse("February 30 at noon")).toBeNull();
  expect(parse("in 0 hours")).toBeNull();
  expect(parseClock("1430")).toBe("14:30");
  expect(parseClock("noon")).toBe("12:00");
});
