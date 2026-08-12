import { useState, useEffect } from "react";

export function useNarrow(bp = 700): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const handle = (e: MediaQueryListEvent) => setNarrow(e.matches);
    setNarrow(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handle);
    else mq.addListener(handle);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handle);
      else mq.removeListener(handle);
    };
  }, [bp]);
  return narrow;
}
