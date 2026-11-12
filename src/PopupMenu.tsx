import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
export interface MenuAction {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  category?: import("./taskColors").TaskCategory;
  onSelect: () => void;
}
export function PopupMenu({
  label,
  x,
  y,
  actions,
  onClose,
}: {
  label: string;
  x: number;
  y: number;
  actions: MenuAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const menu = ref.current!;
    // Measure untransformed geometry: the entrance scale must not move edge menus offscreen.
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.querySelector("button")?.focus();
    return () => previous?.focus();
  }, [x, y, label]);
  return createPortal(
    <div
      className="menu-shield"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        className="context-menu material-menu"
        role="menu"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          const buttons = Array.from(ref.current!.querySelectorAll("button"));
          const i = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (e.key === "Escape" || e.key === "Tab") {
            e.preventDefault();
            onClose();
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            buttons[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? buttons.length - 1
                  : (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                    buttons.length
            ]?.focus();
          }
        }}
      >
        {actions.map((a) => (
          <button
            key={a.id}
            role="menuitem"
            className={a.danger ? "danger" : ""}
            onClick={() => {
              onClose();
              a.onSelect();
            }}
          >
            <span aria-hidden="true" data-status={a.category}>
              {a.icon}
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
