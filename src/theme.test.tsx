// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTheme } from "./theme";
import type { Settings } from "./model";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  setTheme: vi.fn(async () => {}),
  theme: vi.fn(async () => "dark"),
  onThemeChanged: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => mocks }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("glass-scope");
  mocks.invoke.mockReset();
});
it("updates native eligibility when transparency policy changes and removes listeners", async () => {
  const queries = new Map<
    string,
    {
      matches: boolean;
      listeners: Set<() => void>;
      addEventListener: (_: string, cb: () => void) => void;
      removeEventListener: (_: string, cb: () => void) => void;
    }
  >();
  vi.stubGlobal("matchMedia", (name: string) => {
    if (!queries.has(name)) {
      const listeners = new Set<() => void>();
      queries.set(name, {
        matches: false,
        listeners,
        addEventListener: (_, cb) => {
          listeners.add(cb);
        },
        removeEventListener: (_, cb) => {
          listeners.delete(cb);
        },
      });
    }
    return queries.get(name);
  });
  mocks.invoke.mockImplementation(async (_cmd, args) => ({
    mode: args.allow ? "clear" : "off",
    error: null,
  }));
  const view = renderHook(() =>
    useTheme({ desktop_material: "clear", desktop_tint: 90 } as Settings),
  );
  await waitFor(() => expect(view.result.current).toBe(true));
  expect(document.documentElement.classList.contains("glass-scope")).toBe(true);
  expect(document.documentElement.dataset.glassVariant).toBe("clear");
  const policy = queries.get("(prefers-reduced-transparency: reduce)")!;
  act(() => {
    policy.matches = true;
    policy.listeners.forEach((cb) => cb());
  });
  await waitFor(() =>
    expect(document.documentElement.dataset.desktopGlass).toBe("off"),
  );
  expect(mocks.invoke).toHaveBeenLastCalledWith("native_glass", {
    dark: false,
    allow: false,
  });
  expect(document.documentElement.classList.contains("glass-scope")).toBe(
    false,
  );
  view.unmount();
  for (const query of queries.values()) expect(query.listeners.size).toBe(0);
});
