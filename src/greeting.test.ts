import { expect, it } from "vitest";
import { greeting } from "./greeting";
it("stays stable within a local period, varies through the day and trims optional names", () => {
  const at = (hour: number, minute = 0) =>
    new Date(2026, 10, 13, hour, minute).getTime() / 1000;
  expect(greeting(at(9), " Rico ")).toBe(greeting(at(10, 30), "Rico"));
  expect(greeting(at(9), "Rico")).toContain(", Rico.");
  expect(greeting(at(9), " ")).toBe(greeting(at(9)));
  expect(
    new Set([1, 9, 14, 19, 23].map((hour) => greeting(at(hour)))).size,
  ).toBeGreaterThanOrEqual(4);
});

it("cycles through six greetings for each time band without changing while the app is hidden", () => {
  for (const hour of [1, 9, 14, 19, 23]) {
    const variants = Array.from({ length: 6 }, (_, day) =>
      greeting(new Date(2026, 10, 10 + day, hour).getTime() / 1000, "Rico"),
    );
    expect(new Set(variants).size).toBe(6);
    expect(variants.every((text) => text.endsWith(", Rico."))).toBe(true);
    expect(
      variants.some((text) => /moment|check-in|fresh start/i.test(text)),
    ).toBe(false);
  }
});
