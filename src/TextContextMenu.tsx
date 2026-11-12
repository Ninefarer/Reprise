import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { PopupMenu, type MenuAction } from "./PopupMenu";
type Field = HTMLInputElement | HTMLTextAreaElement;
interface Selection {
  field: Field;
  start: number;
  end: number;
  value: string;
  x: number;
  y: number;
}
/** Use the browser editing engine, rather than assigning .value, to keep its undo stack. */
export function editField(
  selection: Selection,
  command: string,
  value?: string,
) {
  const { field, start, end } = selection;
  if (!field.isConnected || field.disabled || field.value !== selection.value)
    throw Error("The field changed. Open its menu again.");
  field.focus({ preventScroll: true });
  field.setSelectionRange(start, end);
  if (!document.execCommand(command, false, value))
    throw Error(
      "This edit isn't available here. Use the keyboard shortcut instead.",
    );
}
export function TextContextMenus() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const writing = useRef(false);
  useEffect(() => {
    const context = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest(".menu-shield"))
        return;
      const field = target.closest("input, textarea");
      // Leave specialized controls, password fields and contenteditable to WebView2.
      // Their native menu preserves behavior we can't safely reproduce generically.
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
      ) {
        if (
          field instanceof HTMLInputElement &&
          !["text", "search", "url", "tel"].includes(field.type)
        )
          return;
        if (
          field.disabled ||
          field.selectionStart === null ||
          field.selectionEnd === null
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (writing.current) return;
        field.focus({ preventScroll: true });
        generation.current++;
        setError("");
        const rect = field.getBoundingClientRect();
        setSelection({
          field,
          start: field.selectionStart,
          end: field.selectionEnd,
          value: field.value,
          x: event.clientX || rect.left + 16,
          y: event.clientY || rect.bottom,
        });
      } else {
        generation.current++;
        setSelection(null);
        // Keep useful native selection/link/image menus; blank app chrome has no menu.
        if (
          !target.closest("a,img,[contenteditable=true],select") &&
          !window.getSelection()?.toString()
        )
          event.preventDefault();
      }
    };
    document.addEventListener("contextmenu", context, true);
    return () => {
      generation.current++;
      document.removeEventListener("contextmenu", context, true);
    };
  }, []);
  const canEdit = !!selection && !selection.field.readOnly;
  const selected = !!selection && selection.end > selection.start;
  async function perform(command: string) {
    if (!selection || writing.current) return;
    const current = generation.current;
    writing.current = true;
    try {
      if (command === "copy" || command === "cut") {
        await writeText(selection.value.slice(selection.start, selection.end));
        if (
          command === "cut" &&
          generation.current === current &&
          document.activeElement === selection.field
        )
          editField(selection, "delete");
      } else if (command === "paste") {
        const text = await readText();
        if (
          generation.current === current &&
          text &&
          document.activeElement === selection.field
        )
          editField(selection, "insertText", text);
      } else if (command === "selectAll") {
        if (selection.field.isConnected) {
          selection.field.focus({ preventScroll: true });
          selection.field.select();
        }
      } else editField(selection, command);
    } catch (e) {
      setError(`Text edit: ${String(e)}`);
    } finally {
      writing.current = false;
    }
  }
  const canUndo = canEdit && !!document.queryCommandEnabled?.("undo");
  const canRedo = canEdit && !!document.queryCommandEnabled?.("redo");
  const actions: MenuAction[] = [
    { id: "undo", label: "Undo", shortcut: "Ctrl+Z", disabled: !canUndo },
    { id: "redo", label: "Redo", shortcut: "Ctrl+Y", disabled: !canRedo },
    {
      id: "cut",
      label: "Cut",
      shortcut: "Ctrl+X",
      disabled: !canEdit || !selected,
      separatorBefore: true,
    },
    { id: "copy", label: "Copy", shortcut: "Ctrl+C", disabled: !selected },
    { id: "paste", label: "Paste", shortcut: "Ctrl+V", disabled: !canEdit },
    {
      id: "selectAll",
      label: "Select All",
      shortcut: "Ctrl+A",
      disabled: !selection?.value.length,
      separatorBefore: true,
    },
  ].map((a) => ({ ...a, onSelect: () => void perform(a.id) }));
  return (
    <>
      {selection && (
        <PopupMenu
          request={selection}
          label="Text editing"
          x={selection.x}
          y={selection.y}
          actions={actions}
          onClose={() => setSelection(null)}
        />
      )}
      {error &&
        createPortal(
          <div className="text-menu-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>,
          document.activeElement?.closest("dialog[open]") ?? document.body,
        )}
    </>
  );
}
