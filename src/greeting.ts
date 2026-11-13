/** Stable within each local time period, including after a hidden-window restore. */
export function greeting(at: number, name = "") {
  const date = new Date(at * 1000),
    hour = date.getHours();
  const choices =
    hour < 5
      ? ["A quiet moment", "Hello, night owl", "Still up"]
      : hour < 12
        ? ["Good morning", "A fresh start", "Morning, welcome back"]
        : hour < 17
          ? ["Good afternoon", "Hello again", "An afternoon check-in"]
          : hour < 22
            ? ["Good evening", "Evening, welcome back", "A moment to return"]
            : ["A quiet evening", "Hello, night owl", "An evening check-in"];
  const index =
    (date.getFullYear() + date.getMonth() * 31 + date.getDate()) %
    choices.length;
  return `${choices[index]}${name.trim() ? `, ${name.trim()}` : ""}.`;
}
