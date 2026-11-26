// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { AppearanceSettings } from "./AppearanceSettings";
import { selectOption } from "./testControls";
import type { Settings } from "./model";
afterEach(cleanup);
it("keeps palette, aesthetic, glass details and motion independent", async () => {
  function Harness() {
    const [settings, setSettings] = useState({
      theme_family: "pitch-black",
      theme: "dark",
      desktop_glass: true,
      desktop_material: "clear",
      desktop_tint: 90,
      animation: "expressive",
    } as Settings);
    return (
      <AppearanceSettings
        settings={settings}
        onChange={async (patch) => setSettings((s) => ({ ...s, ...patch }))}
      />
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  expect(screen.getByLabelText("Aesthetic").textContent).toContain("Glass");
  await selectOption(user, screen.getByLabelText("Glass material"), "tinted");
  await selectOption(user, screen.getByLabelText("Motion"), "off");
  await selectOption(user, screen.getByLabelText("Theme"), "ashen-white");
  expect(screen.getByLabelText("Glass material").textContent).toContain(
    "Tinted",
  );
  await selectOption(user, screen.getByLabelText("Aesthetic"), "solid");
  expect(screen.queryByLabelText("Glass material")).toBeNull();
  await selectOption(user, screen.getByLabelText("Aesthetic"), "glass");
  expect(screen.getByLabelText("Glass material").textContent).toContain(
    "Tinted",
  );
  expect((screen.getByLabelText(/Glass tint:/) as HTMLInputElement).value).toBe(
    "90",
  );
  expect(screen.getByLabelText("Motion").textContent).toContain("Reduced");
  fireEvent.change(screen.getByLabelText(/Glass tint:/), {
    target: { value: "35" },
  });
  expect(screen.getByLabelText("Glass material").textContent).toContain(
    "Tinted",
  );
});
it("explains a temporary solid fallback without replacing Glass controls", () => {
  render(
    <AppearanceSettings
      settings={{ aesthetic: "glass" } as Settings}
      surfaceFallback="Unsupported"
      onChange={async () => {}}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain(
    "Windows is using a solid surface.",
  );
  expect(screen.getByLabelText("Glass material")).toBeTruthy();
});
