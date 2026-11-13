import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MenuGlyph } from "./menuIcons";
export interface MenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  shortcut?: string;
  category?: import("./taskColors").TaskCategory;
  onSelect: () => void;
}

export function PopupMenu({
  label,
  x,
  y,
  actions,
  request,
  onClose,
}: {
  label: string;
  x: number;
  y: number;
  actions: MenuAction[];
  request?: object;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shield = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = useRef<HTMLElement | null>(null);
  const owner = useRef(Symbol("context-menu"));
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const [closing, setClosing] = useState(false);
  const [host] = useState(
    () =>
      document.activeElement?.closest("dialog[open], .setup-screen") ??
      document.body,
  );
  const restore = () => {
    if (previous.current?.isConnected)
      previous.current.focus({ preventScroll: true });
  };
  function close(animate = true, restoreFocus = true) {
    if (closeTimer.current) return;
    if (restoreFocus) restore();
    const reduced =
      document.documentElement.dataset.motion === "off" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) {
      closeCallback.current();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => closeCallback.current(), 90);
  }
  useLayoutEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosing(false);
    previous.current = document.activeElement as HTMLElement;
    const menu = ref.current!,
      layer = shield.current!;
    // Popover puts menus above native <dialog> top-layer surfaces. Inside a modal,
    // portal into that dialog too, so the menu isn't made inert by the modal.
    layer.showPopover?.();
    const place = () => {
      menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    };
    place();
    menu
      .querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
    const resize = () => closeCallback.current();
    const scroll = (e: Event) => {
      if (!menu.contains(e.target as Node)) closeCallback.current();
    };
    const blur = () => closeCallback.current();
    const replace = (e: Event) => {
      if ((e as CustomEvent).detail !== owner.current) closeCallback.current();
    };
    document.dispatchEvent(
      new CustomEvent("reprise-context-menu", { detail: owner.current }),
    );
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("blur", blur);
    document.addEventListener("reprise-context-menu", replace);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("reprise-context-menu", replace);
      if (menu.contains(document.activeElement)) restore();
      layer.hidePopover?.();
    };
  }, [x, y, label, request]);
  return createPortal(
    <div
      ref={shield}
      popover={
        typeof HTMLElement.prototype.showPopover === "function"
          ? "manual"
          : undefined
      }
      className="menu-shield"
      data-closing={closing || undefined}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        // Let a second right-click retarget the underlying task/field rather than
        // requiring an extra click just to dismiss the previous menu.
        const layer = e.currentTarget;
        layer.style.visibility = "hidden";
        const target = document.elementFromPoint(e.clientX, e.clientY);
        layer.style.visibility = "";
        close(false);
        target?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            button: 2,
          }),
        );
      }}
    >
      <div
        ref={ref}
        className="context-menu material-menu"
        role="menu"
        aria-label={label}
        aria-hidden={closing || undefined}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey) {
            const action = actions.find(
              (a) =>
                (!e.shiftKey &&
                  a.shortcut?.toLowerCase() ===
                    `ctrl+${e.key.toLowerCase()}`) ||
                (e.shiftKey && e.key.toLowerCase() === "z" && a.id === "redo"),
            );
            if (action) {
              e.preventDefault();
              e.stopPropagation();
              if (!action.disabled) {
                close(false);
                action.onSelect();
              }
              return;
            }
            // Other application shortcuts may open a dialog; retire this menu first.
            close(false);
            return;
          }
          const buttons = Array.from(
            ref.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          } else if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            close();
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            buttons[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? buttons.length - 1
                  : (index +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      buttons.length) %
                    buttons.length
            ]?.focus();
          } else if (
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.metaKey
          ) {
            const next = [
              ...buttons.slice(index + 1),
              ...buttons.slice(0, index + 1),
            ].find((b) =>
              b
                .getAttribute("aria-label")
                ?.toLowerCase()
                .startsWith(e.key.toLowerCase()),
            );
            next?.focus();
          }
        }}
      >
        {actions.map((a, i) => (
          <Fragment key={a.id}>
            {i > 0 && a.separatorBefore && (
              <div className="menu-separator" role="separator" />
            )}
            <button
              type="button"
              role="menuitem"
              aria-label={a.label}
              aria-keyshortcuts={a.shortcut?.replaceAll("Ctrl", "Control")}
              disabled={closing || a.disabled}
              tabIndex={-1}
              className={a.danger ? "danger" : ""}
              onPointerMove={(e) => {
                if (e.pointerType !== "touch" && !a.disabled && !closing)
                  e.currentTarget.focus({ preventScroll: true });
              }}
              onClick={() => {
                close(false);
                a.onSelect();
              }}
            >
              <span
                className="menu-icon"
                aria-hidden="true"
                data-status={a.category}
              >
                <MenuGlyph id={a.id} fallback={a.icon} />
              </span>
              <span className="menu-label">{a.label}</span>
              {a.shortcut && <kbd aria-hidden="true">{a.shortcut}</kbd>}
            </button>
          </Fragment>
        ))}
      </div>
    </div>,
    host,
  );
}
