import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ControlPopup } from "./ControlPopup";
import "./controls.css";

interface Option {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  status?: string;
}
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
        "data-status"?: string;
      }>(child)
    )
      return [];
    return child.type === "option"
      ? [
          {
            value: String(child.props.value ?? ""),
            label: child.props.children,
            disabled: child.props.disabled,
            status: child.props["data-status"],
          },
        ]
      : optionsFrom(child.props.children);
  });
}
export function Select({
  value,
  onChange,
  children,
  disabled,
  id,
  ...props
}: {
  value: string | number;
  onChange: (event: { target: { value: string } }) => void;
  children: ReactNode;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "data-status"?: string;
}) {
  const options = optionsFrom(children),
    generated = useId(),
    listId = `${generated}-options`;
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const search = useRef({ value: "", at: 0 });
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange({ target: { value: option.value } });
    setOpen(false);
    trigger.current?.focus();
  };
  function reveal() {
    const selected = options.findIndex(
      (o) => o.value === String(value) && !o.disabled,
    );
    setActive(
      selected >= 0
        ? selected
        : Math.max(
            0,
            options.findIndex((o) => !o.disabled),
          ),
    );
    setOpen(true);
  }
  return (
    <>
      <button
        {...props}
        ref={trigger}
        id={id}
        value={String(value)}
        type="button"
        role="combobox"
        className="select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => (open ? setOpen(false) : reveal())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            reveal();
          }
        }}
      >
        <span>
          {options.find((o) => o.value === String(value))?.label ??
            String(value)}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <ControlPopup anchor={trigger} onClose={() => setOpen(false)}>
          <div
            id={listId}
            role="listbox"
            aria-label={
              trigger.current?.labels?.[0]?.textContent?.trim() ||
              props["aria-label"] ||
              "Choices"
            }
            className="select-options"
            onKeyDown={(e) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const enabled = options
                  .map((o, i) => (o.disabled ? -1 : i))
                  .filter((i) => i >= 0);
                const position = enabled.indexOf(active);
                setActive(
                  enabled[
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? enabled.length - 1
                        : (position +
                            (e.key === "ArrowDown" ? 1 : -1) +
                            enabled.length) %
                          enabled.length
                  ] ?? 0,
                );
              } else if (
                e.key.length === 1 &&
                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey &&
                e.key !== " "
              ) {
                e.preventDefault();
                search.current.value =
                  (Date.now() - search.current.at > 700
                    ? ""
                    : search.current.value) + e.key.toLocaleLowerCase();
                search.current.at = Date.now();
                const found = options.findIndex(
                  (o) =>
                    !o.disabled &&
                    String(o.label)
                      .toLocaleLowerCase()
                      .startsWith(search.current.value),
                );
                if (found >= 0) setActive(found);
              }
            }}
          >
            {options.map((o, i) => (
              <SelectOption
                key={o.value}
                option={o}
                selected={String(value) === o.value}
                active={active === i}
                onChoose={() => choose(i)}
                onActive={() => setActive(i)}
              />
            ))}
          </div>
        </ControlPopup>
      )}
    </>
  );
}
function SelectOption({
  option,
  selected,
  active,
  onChoose,
  onActive,
}: {
  option: Option;
  selected: boolean;
  active: boolean;
  onChoose: () => void;
  onActive: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Callback ref keeps focus synchronized without another global keyboard handler.
  return (
    <button
      ref={(node) => {
        ref.current = node;
        if (active) {
          node?.focus({ preventScroll: true });
          node?.scrollIntoView?.({ block: "nearest" });
        }
      }}
      role="option"
      type="button"
      value={option.value}
      data-value={option.value}
      data-status={option.status}
      aria-selected={selected}
      disabled={option.disabled}
      tabIndex={active ? 0 : -1}
      onPointerMove={(e) => {
        if (e.pointerType !== "touch" && !option.disabled) onActive();
      }}
      onClick={onChoose}
    >
      <span>{option.label}</span>
      <span aria-hidden="true">{selected ? "✓" : ""}</span>
    </button>
  );
}
