/** Stable within each local time period, including after a hidden-window restore. */
export function greeting(at: number, name = "") {
  const date = new Date(at * 1000),
    hour = date.getHours();
  const choices =
    hour < 5
      ? [
          "Still up",
          "Hello, night owl",
          "Working late",
          "Up late",
          "Back for a late one",
          "Hello again",
        ]
      : hour < 12
        ? [
            "Good morning",
            "Morning",
            "Hello, early bird",
            "Good to see you this morning",
            "You're up early",
            "Good to see you",
          ]
        : hour < 17
          ? [
              "Good afternoon",
              "Afternoon",
              "Hello again",
              "Good to see you this afternoon",
              "Back at it",
              "Good to see you",
            ]
          : hour < 22
            ? [
                "Good evening",
                "Evening",
                "Welcome back",
                "Good to see you this evening",
                "Back for the evening",
                "Hello again",
              ]
            : [
                "Hello, night owl",
                "Still up",
                "Welcome back",
                "Up a little later",
                "Working late",
                "Hello again",
              ];
  const index =
    (date.getFullYear() + date.getMonth() * 31 + date.getDate()) %
    choices.length;
  return `${choices[index]}${name.trim() ? `, ${name.trim()}` : ""}.`;
}
