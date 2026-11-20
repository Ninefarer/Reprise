import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motionAllowed, observeMotionPolicy } from "./motion";
export const NOTICE_MOTION_MS = 320;
export function SlideSlot({
  children,
  leaving = false,
}: {
  children: ReactNode;
  leaving?: boolean;
}) {
  return (
    <div
      className="notice-slot"
      data-leaving={leaving}
      inert={leaving}
      aria-hidden={leaving || undefined}
    >
      <div className="notice-clip">
        <div className="notice-space">{children}</div>
      </div>
    </div>
  );
}
interface Entry<T> {
  key: string;
  item: T;
  leaving: boolean;
}
// Retain removed records only for their exit animation, never as live actions.
export function useNoticePresence<T extends { id: string }>(
  items: T[],
  scope: string,
) {
  const [entries, setEntries] = useState<Entry<T>[]>(() =>
    items.map((item) => ({ key: item.id, item, leaving: false })),
  );
  const lastScope = useRef(scope);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useLayoutEffect(() => {
    const reset = lastScope.current !== scope;
    lastScope.current = scope;
    setEntries((current) => {
      const next = items.map((item) => ({
        key: item.id,
        item,
        leaving: false,
      }));
      if (!reset && motionAllowed()) {
        current.forEach((entry, index) => {
          if (!items.some((item) => item.id === entry.key))
            next.splice(Math.min(index, next.length), 0, {
              ...entry,
              leaving: true,
            });
        });
      }
      return current.length === next.length &&
        current.every(
          (entry, index) =>
            entry.item === next[index].item &&
            entry.leaving === next[index].leaving,
        )
        ? current
        : next;
    });
  }, [items, scope]);
  useEffect(() => {
    for (const [key, timer] of timers.current) {
      if (!entries.some((entry) => entry.key === key && entry.leaving)) {
        clearTimeout(timer);
        timers.current.delete(key);
      }
    }
    for (const entry of entries) {
      if (!entry.leaving || timers.current.has(entry.key)) continue;
      timers.current.set(
        entry.key,
        setTimeout(() => {
          timers.current.delete(entry.key);
          setEntries((current) =>
            current.filter((item) => item.key !== entry.key || !item.leaving),
          );
        }, NOTICE_MOTION_MS),
      );
    }
  }, [entries]);
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    },
    [],
  );
  useEffect(
    () =>
      observeMotionPolicy(() => {
        for (const timer of timers.current.values()) clearTimeout(timer);
        timers.current.clear();
        setEntries((current) => current.filter((entry) => !entry.leaving));
      }),
    [],
  );
  return entries;
}
