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
it("ignores a stale native response after transparency accessibility policy changes", async () => {
  const listeners = new Set<() => void>(),
    policy = {
      matches: false,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    };
  vi.stubGlobal("matchMedia", (name: string) =>
    name === "(prefers-reduced-transparency: reduce)"
      ? policy
      : {
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        },
  );
  const pending: ((result: { mode: string; error: null }) => void)[] = [];
  mocks.invoke.mockImplementation((_cmd, args) =>
    args.allow
      ? new Promise((resolve) => pending.push(resolve))
      : Promise.resolve({ mode: "off", error: null }),
  );
  renderHook(() =>
    useTheme({ desktop_glass: true, desktop_material: "clear" } as Settings),
  );
  await act(async () => {});
  expect(pending.length).toBeGreaterThan(0);
  act(() => {
    policy.matches = true;
    listeners.forEach((cb) => cb());
  });
  await waitFor(() =>
    expect(document.documentElement.dataset.desktopGlass).toBe("off"),
  );
  await act(async () =>
    pending.forEach((resolve) => resolve({ mode: "clear", error: null })),
  );
  expect(document.documentElement.dataset.desktopGlass).toBe("off");
  expect(document.documentElement.classList.contains("glass-scope")).toBe(
    false,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("glass-scope");
  mocks.invoke.mockReset();
});
it("keeps the selected Glass aesthetic and Tinted recipe during an unsupported-backdrop fallback", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  mocks.invoke.mockResolvedValue({
    mode: "off",
    error: "Unsupported backdrop",
  });
  const fallback = vi.fn(),
    settings = {
      aesthetic: "glass",
      theme_family: "pitch-black",
      desktop_material: "tinted",
      desktop_tint: 90,
      animation: "expressive",
    } as Settings;
  const view = renderHook(() => useTheme(settings, undefined, fallback));
  await waitFor(() => expect(view.result.current).toBe(true));
  expect(document.documentElement.dataset.aesthetic).toBe("glass");
  expect(document.documentElement.dataset.glassVariant).toBe("tinted");
  expect(document.documentElement.dataset.desktopGlass).toBe("off");
  expect(fallback).toHaveBeenCalledWith("Unsupported backdrop");
  expect(settings.aesthetic).toBe("glass");
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
