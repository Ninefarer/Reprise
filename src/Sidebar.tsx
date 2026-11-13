import { isNightly, NightlyBadge } from "./Nightly";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings, View } from "./model";
import { label } from "./model";
import { navigation, Icon, type NavigationGroup } from "./navigation";
import { Avatar } from "./Profile";
import { createPortal } from "react-dom";
import { taskCategory } from "./taskColors";
import { PopupMenu, type MenuAction } from "./PopupMenu";
export function Sidebar({
  settings,
  version,
  avatar,
  view,
  count,
  onNavigate,
  onQuit,
  onPatch,
}: {
  settings: Settings;
  version?: string;
  avatar?: string | null;
  view: View;
  count: (v: View) => number | null;
  onNavigate: (v: View, anchor?: string) => void;
  onQuit?: () => void;
  onPatch: (p: Partial<Settings>) => Promise<void>;
}) {
  const [width, setWidth] = useState(settings.sidebar_width ?? 224),
    lastWidth = useRef(width),
    [dragging, setDragging] = useState(false),
    [profileOpen, setProfileOpen] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    group?: NavigationGroup;
    view?: View;
  } | null>(null);
  const [tooltip, setTooltip] = useState<{
    view: View;
    x: number;
    y: number;
  } | null>(null);
  const draggingRef = useRef(false);
  const collapsed = settings.sidebar_collapsed ?? false;
  useEffect(() => setTooltip(null), [collapsed]);
  useEffect(() => {
    if (!dragging) setWidth(settings.sidebar_width ?? 224);
  }, [settings.sidebar_width]);
  function resize(n: number) {
    const w = Math.max(190, Math.min(340, n));
    lastWidth.current = w;
    setWidth(w);
  }
  const expanded = (id: NavigationGroup) =>
    settings.sidebar_groups?.[id] !== false;
  const setGroup = (id: NavigationGroup, value: boolean) =>
    void onPatch({ sidebar_groups: { [id]: value } });
  const setAll = (value: boolean) =>
    void onPatch({
      sidebar_groups: Object.fromEntries(navigation.map((g) => [g.id, value])),
    });
  const group =
    !collapsed && menu?.group
      ? navigation.find((g) => g.id === menu.group)
      : undefined;
  const actions: MenuAction[] = menu
    ? [
        ...(menu.view
          ? [
              {
                id: "open",
                label: `Open ${label(menu.view)}`,
                onSelect: () => onNavigate(menu.view!),
              },
            ]
          : []),
        ...(group
          ? [
              {
                id: "group",
                label: `${expanded(group.id) ? "Collapse" : "Expand"} ${group.title}`,
                onSelect: () => setGroup(group.id, !expanded(group.id)),
              },
              {
                id: "only",
                label: `Show only ${group.title}`,
                onSelect: () =>
                  void onPatch({
                    sidebar_groups: Object.fromEntries(
                      navigation.map((g) => [g.id, g.id === group.id]),
                    ),
                  }),
              },
            ]
          : []),
        ...(!collapsed
          ? [
              {
                id: "expand-all",
                label: "Expand all groups",
                onSelect: () => setAll(true),
              },
              {
                id: "collapse-all",
                label: "Collapse all groups",
                onSelect: () => setAll(false),
              },
            ]
          : []),
        {
          id: "sidebar",
          label: collapsed ? "Expand sidebar" : "Collapse sidebar",
          onSelect: () => void onPatch({ sidebar_collapsed: !collapsed }),
        },
        ...(!collapsed
          ? [
              {
                id: "reset-width",
                label: "Reset sidebar width",
                onSelect: () => {
                  resize(224);
                  void onPatch({ sidebar_width: 224 });
                },
              },
            ]
          : []),
      ]
    : [];
  return (
    <aside
      className={collapsed ? "sidebar collapsed" : "sidebar"}
      style={{ width: collapsed ? 64 : width }}
      data-resizing={dragging}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest(".profile-footer")) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {isNightly(version) && (
        <div className="nightly-header">
          <NightlyBadge version={version!} />
        </div>
      )}
      <nav aria-label="Main navigation" tabIndex={0}>
        {navigation.map((g) => (
          <section className="nav-group" key={g.id}>
            <div className="nav-group-heading">
              <h2>
                <button
                  className={`nav-group-toggle ${!expanded(g.id) && g.items.includes(view) ? "contains-active" : ""}`}
                  aria-expanded={expanded(g.id)}
                  aria-controls={`nav-${g.id}`}
                  onClick={() => setGroup(g.id, !expanded(g.id))}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.preventDefault();
                      setGroup(g.id, e.key === "ArrowRight");
                    }
                    if (
                      e.key === "ContextMenu" ||
                      (e.shiftKey && e.key === "F10")
                    ) {
                      e.preventDefault();
                      const r = e.currentTarget.getBoundingClientRect();
                      setMenu({ x: r.left, y: r.bottom, group: g.id });
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenu({ x: e.clientX, y: e.clientY, group: g.id });
                  }}
                >
                  <span>{g.title}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    width="12"
                    height="12"
                    className={
                      expanded(g.id)
                        ? "group-chevron expanded"
                        : "group-chevron"
                    }
                  >
                    <path
                      d="m4 2 4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                </button>
              </h2>
              {g.id === "general" && (
                <button
                  className="collapse-toggle"
                  title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={() =>
                    void onPatch({ sidebar_collapsed: !collapsed })
                  }
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M9 4v16" />
                    <path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"} />
                  </svg>
                </button>
              )}
            </div>
            <div
              className="nav-items"
              id={`nav-${g.id}`}
              hidden={!collapsed && !expanded(g.id)}
              aria-hidden={!collapsed && !expanded(g.id)}
              inert={!collapsed && !expanded(g.id)}
            >
              <div className="nav-items-inner">
                {g.items.map((v) => (
                  <button
                    key={v}
                    data-status={taskCategory(v)}
                    title={collapsed ? undefined : label(v)}
                    aria-describedby={
                      tooltip?.view === v ? "sidebar-tooltip" : undefined
                    }
                    onMouseEnter={(e) => {
                      if (collapsed) {
                        const r = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          view: v,
                          x: r.right + 10,
                          y: Math.max(
                            16,
                            Math.min(innerHeight - 16, r.top + r.height / 2),
                          ),
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={(e) => {
                      if (collapsed) {
                        const r = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          view: v,
                          x: r.right + 10,
                          y: r.top + r.height / 2,
                        });
                      }
                    }}
                    onBlur={() => setTooltip(null)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "ContextMenu" ||
                        (e.shiftKey && e.key === "F10")
                      ) {
                        e.preventDefault();
                        setTooltip(null);
                        const r = e.currentTarget.getBoundingClientRect();
                        setMenu({ x: r.right, y: r.top, group: g.id, view: v });
                      }
                    }}
                    aria-current={view === v ? "page" : undefined}
                    className={view === v ? "active" : ""}
                    onClick={() => {
                      setTooltip(null);
                      onNavigate(v);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenu({
                        x: e.clientX,
                        y: e.clientY,
                        group: g.id,
                        view: v,
                      });
                    }}
                  >
                    <Icon name={v} />
                    <span className="sidebar-label">{label(v)}</span>
                    {!collapsed && (count(v) ?? 0) > 0 && (
                      <span
                        className="nav-count"
                        aria-label={`${count(v)} items`}
                      >
                        {count(v)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ))}
      </nav>
      <details
        className="profile-footer"
        onToggle={(e) => setProfileOpen(e.currentTarget.open)}
      >
        <summary
          title="Profile menu"
          aria-label={`Profile menu for ${settings.name || "Your profile"}`}
        >
          <Avatar src={avatar} name={settings.name} />
          <span className="profile-text">
            <strong>{settings.name || "Your profile"}</strong>
          </span>
        </summary>
        {profileOpen && (
          <div
            className="material-menu"
            role="menu"
            aria-label="Profile menu"
            onKeyDown={(e) => {
              const menu = e.currentTarget;
              const buttons = Array.from(menu.querySelectorAll("button"));
              const i = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (e.key === "Escape") {
                menu.closest("details")!.open = false;
                (menu.previousElementSibling as HTMLElement).focus();
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                buttons[
                  (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                    buttons.length
                ]?.focus();
              }
            }}
          >
            <button
              role="menuitem"
              onClick={(event) => {
                event.currentTarget.closest("details")!.open = false;
                onNavigate("Settings");
              }}
            >
              Settings
            </button>
            <button
              role="menuitem"
              onClick={() => (onQuit ? onQuit() : void invoke("quit_app"))}
            >
              Quit Reprise
            </button>
          </div>
        )}
      </details>
      {!collapsed && (
        <div
          className="sidebar-resizer"
          role="separator"
          aria-label="Sidebar width"
          aria-orientation="vertical"
          aria-valuemin={190}
          aria-valuemax={340}
          aria-valuenow={width}
          tabIndex={0}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
              e.preventDefault();
              const w = Math.max(
                190,
                Math.min(340, width + (e.key === "ArrowRight" ? 10 : -10)),
              );
              resize(w);
              void onPatch({ sidebar_width: w });
            }
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            draggingRef.current = true;
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) resize(e.clientX);
          }}
          onPointerUp={(e) => {
            if (draggingRef.current) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              setDragging(false);
              draggingRef.current = false;
              void onPatch({ sidebar_width: lastWidth.current });
            }
          }}
          onPointerCancel={() => {
            setDragging(false);
            draggingRef.current = false;
            setWidth(settings.sidebar_width ?? 224);
          }}
        />
      )}
      {menu && (
        <PopupMenu
          request={menu}
          label="Sidebar actions"
          x={menu.x}
          y={menu.y}
          actions={actions}
          onClose={() => setMenu(null)}
        />
      )}
      {collapsed &&
        tooltip &&
        !menu &&
        createPortal(
          <div
            role="tooltip"
            id="sidebar-tooltip"
            className="sidebar-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {label(tooltip.view)}
          </div>,
          document.body,
        )}
    </aside>
  );
}
