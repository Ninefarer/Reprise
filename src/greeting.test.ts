import { expect, it } from "vitest";
import { greeting } from "./greeting";
it("stays stable within a local period, varies through the day and trims optional names", () => {
  const at = (hour: number, minute = 0) =>
    new Date(2026, 10, 13, hour, minute).getTime() / 1000;
  expect(greeting(at(9), " Rico ")).toBe(greeting(at(10, 30), "Rico"));
  expect(greeting(at(9), "Rico")).toContain(", Rico.");
  expect(greeting(at(9), " ")).not.toContain(",");
  expect(
    new Set([1, 9, 14, 19, 23].map((hour) => greeting(at(hour)))).size,
  ).toBeGreaterThanOrEqual(4);
});
