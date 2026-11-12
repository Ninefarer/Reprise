// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PopupMenu } from "./PopupMenu";
import { TextContextMenus } from "./TextContextMenu";
const clipboard = vi.hoisted(() => ({ readText: vi.fn(), writeText: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => clipboard);
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false }),
  });
  document.documentElement.dataset.motion = "subtle";
  document.execCommand = vi.fn(() => true);
  document.queryCommandEnabled = vi.fn(() => true);
  clipboard.writeText.mockResolvedValue(undefined);
  clipboard.readText.mockResolvedValue("pasted text");
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-motion");
});
describe("shared context menus", () => {
  it("executes the displayed clipboard shortcut while a menu is open", () => {
    const select = vi.fn(),
      close = vi.fn();
    render(
      <PopupMenu
        label="Shortcut"
        x={10}
        y={10}
        onClose={close}
        actions={[
          { id: "paste", label: "Paste", shortcut: "Ctrl+V", onSelect: select },
        ]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("menuitem"), {
      key: "v",
      ctrlKey: true,
    });
    expect(select).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it("cancels a pending exit when rapidly reopening at the same position", async () => {
    const close = vi.fn();
    const props = {
      label: "Reopen",
      x: 12,
      y: 12,
      onClose: close,
      actions: [{ id: "copy", label: "Copy", onSelect: vi.fn() }],
    };
    const app = render(<PopupMenu {...props} request={{}} />);
    fireEvent.keyDown(screen.getByRole("menuitem"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    app.rerender(<PopupMenu {...props} request={{}} />);
    expect(screen.getByRole("menu")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(close).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("menuitem"));
  });
  it("skips disabled entries, supports Home/End and restores focus on Escape", async () => {
    const before = document.createElement("button");
    document.body.append(before);
    before.focus();
    const close = vi.fn();
    render(
      <PopupMenu
        label="Test actions"
        x={10}
        y={10}
        onClose={close}
        actions={[
          { id: "copy", label: "Copy", disabled: true, onSelect: vi.fn() },
          {
            id: "paste",
            label: "Paste",
            shortcut: "Ctrl+V",
            onSelect: vi.fn(),
          },
          {
            id: "selectAll",
            label: "Select All",
            separatorBefore: true,
            onSelect: vi.fn(),
          },
        ]}
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Paste" }),
    );
    expect(screen.getByRole("separator")).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Select All" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Paste" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(document.activeElement).toBe(before);
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    before.remove();
  });
  it("clamps measured menu geometry to the viewport and dismisses on resize", () => {
    const width = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(240);
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(260);
    const close = vi.fn();
    render(
      <PopupMenu
        label="Edge"
        x={innerWidth + 20}
        y={innerHeight + 20}
        onClose={close}
        actions={[{ id: "copy", label: "Copy", onSelect: vi.fn() }]}
      />,
    );
    const menu = screen.getByRole("menu");
    expect(parseFloat(menu.style.left)).toBe(innerWidth - 248);
    expect(parseFloat(menu.style.top)).toBe(innerHeight - 268);
    fireEvent(window, new Event("resize"));
    expect(close).toHaveBeenCalledOnce();
    width.mockRestore();
    height.mockRestore();
  });
  it("portals a text menu inside its active modal and activates actions immediately", () => {
    const modal = document.createElement("dialog");
    modal.open = true;
    const field = document.createElement("input");
    modal.append(field);
    document.body.append(modal);
    field.focus();
    const select = vi.fn(),
      close = vi.fn();
    render(
      <PopupMenu
        label="Modal menu"
        x={10}
        y={10}
        onClose={close}
        actions={[{ id: "copy", label: "Copy", onSelect: select }]}
      />,
    );
    expect(modal.contains(screen.getByRole("menu"))).toBe(true);
    fireEvent.click(screen.getByRole("menuitem"));
    expect(select).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(field);
    modal.remove();
  });
  it("does not leave competing menu owners open", () => {
    const close = vi.fn();
    const first = render(
      <PopupMenu label="First" x={10} y={10} onClose={close} actions={[]} />,
    );
    render(
      <PopupMenu label="Second" x={20} y={20} onClose={vi.fn()} actions={[]} />,
    );
    expect(close).toHaveBeenCalledOnce();
    first.unmount();
  });
});
function TextFixture({ readOnly = false }: { readOnly?: boolean }) {
  const [text, setText] = useState("alpha beta");
  return (
    <>
      <textarea
        aria-label="Notes"
        value={text}
        readOnly={readOnly}
        onChange={(e) => setText(e.target.value)}
      />
      <input aria-label="Password" type="password" />
      <input aria-label="Other" />
      <TextContextMenus />
    </>
  );
}
function openText() {
  const field = screen.getByLabelText("Notes") as HTMLTextAreaElement;
  field.focus();
  field.setSelectionRange(0, 5);
  fireEvent.contextMenu(field, { clientX: 20, clientY: 40 });
  return field;
}
describe("text context menus", () => {
  it("copies the clicked field's actual selection without reading the clipboard on open", async () => {
    render(<TextFixture />);
    const field = openText();
    expect(clipboard.readText).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    expect(clipboard.writeText).toHaveBeenCalledWith("alpha");
    expect(field.value).toBe("alpha beta");
    expect(document.activeElement).toBe(field);
  });
  it.each(["Cut", "Paste", "Undo", "Redo"])(
    "routes %s through the browser undo-preserving editing engine",
    async (label) => {
      render(<TextFixture />);
      const field = openText();
      await userEvent.click(screen.getByRole("menuitem", { name: label }));
      const command = {
        Cut: "delete",
        Paste: "insertText",
        Undo: "undo",
        Redo: "redo",
      }[label]!;
      await waitFor(() =>
        expect(document.execCommand).toHaveBeenCalledWith(
          command,
          false,
          label === "Paste" ? "pasted text" : undefined,
        ),
      );
      expect(field.selectionStart).toBe(0);
      expect(field.selectionEnd).toBe(5);
      if (label === "Cut")
        expect(clipboard.writeText).toHaveBeenCalledWith("alpha");
    },
  );
  it("selects the whole field and keeps read-only mutation actions disabled", async () => {
    render(<TextFixture readOnly />);
    const field = openText();
    const menu = screen.getByRole("menu");
    for (const name of ["Cut", "Paste", "Undo", "Redo"])
      expect(
        (within(menu).getByRole("menuitem", { name }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Select All" }),
    );
    expect(field.selectionEnd).toBe(field.value.length);
    expect(document.activeElement).toBe(field);
  });
  it("never replaces password/native specialized menus or intercepts Ctrl+C", () => {
    render(<TextFixture />);
    const native = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    screen.getByLabelText("Password").dispatchEvent(native);
    expect(native.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
    const key = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    screen.getByLabelText("Notes").dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
  });
  it("reports clipboard failure without modifying the field", async () => {
    clipboard.readText.mockRejectedValue(Error("Clipboard busy"));
    render(<TextFixture />);
    const field = openText();
    await userEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    await screen.findByRole("alert");
    expect(field.value).toBe("alpha beta");
    expect(document.execCommand).not.toHaveBeenCalled();
  });
  it("does not paste into a changed field or steal focus after an asynchronous read", async () => {
    let resolve!: (value: string) => void;
    clipboard.readText.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );
    render(<TextFixture />);
    openText();
    await userEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    screen.getByLabelText("Other").focus();
    resolve("late clipboard");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Other")),
    );
    expect(document.execCommand).not.toHaveBeenCalled();
  });
});
