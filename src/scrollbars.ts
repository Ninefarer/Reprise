import { useEffect } from "react";
/** Native scrollbars remain native; only their idle styling is transient. */
export function useScrollActivity() {
  useEffect(() => {
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    const onScroll = (e: Event) => {
      const target =
        e.target === document ? document.documentElement : e.target;
      if (!(target instanceof HTMLElement)) return;
      clearTimeout(timers.get(target));
      target.dataset.scrolling = "true";
      timers.set(
        target,
        setTimeout(() => {
          delete target.dataset.scrolling;
          timers.delete(target);
        }, 900),
      );
    };
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      timers.forEach((timer, element) => {
        clearTimeout(timer);
        delete element.dataset.scrolling;
      });
    };
  }, []);
}
