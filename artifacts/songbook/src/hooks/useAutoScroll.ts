import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type Mode = "speed" | "follow";

export interface AutoScroll {
  isScrolling: boolean;
  /** Constant px/s scroll toward the bottom (host / solo / aux controls). */
  startSpeed: (pxPerSec: number) => void;
  /** Live-adjust speed without restarting (drag the scrubber mid-scroll). */
  setSpeed: (pxPerSec: number) => void;
  /** Seek to `fraction` of this view, then reach the bottom in `durationMs`. */
  startFollow: (fraction: number, durationMs: number) => void;
  /** Re-anchor an in-progress follow (drift correction / mid-join). */
  seekFollow: (fraction: number, remainingMs: number) => void;
  stop: () => void;
  /** Current normalized position; used by the host to broadcast its progress. */
  metrics: () => { fraction: number; max: number; scrollTop: number };
}

/**
 * Single auto-scroll engine for a scroll container. Supports a constant-speed
 * mode and a duration-to-bottom "follow" mode. Follow mode re-derives speed
 * every frame so every device lands at the bottom at the same wall-clock time
 * regardless of font size (more pixels => faster), which is what keeps a band
 * scrolling in lockstep.
 */
export function useAutoScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
): AutoScroll {
  const [isScrolling, setIsScrolling] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  // Float accumulator: the browser rounds scrollTop, so reading it back each
  // frame would lose sub-pixel deltas and stall slow scrolls. We own the true
  // position here and write it out.
  const posRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>("speed");
  const speedRef = useRef(0);
  const endTimeRef = useRef(0); // performance.now() target for follow mode

  const stop = useCallback(() => {
    setIsScrolling(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = 0;
    posRef.current = null;
  }, []);

  const step = useCallback(
    (ts: number) => {
      const el = scrollRef.current;
      if (!el) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (!lastTsRef.current) lastTsRef.current = ts;
      if (posRef.current === null) posRef.current = el.scrollTop;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (max <= 0) {
        stop();
        return;
      }

      if (modeRef.current === "follow") {
        const remainingMs = endTimeRef.current - ts;
        const remainingPx = max - posRef.current;
        if (remainingMs <= 16 || remainingPx <= 0.5) {
          el.scrollTop = max;
          stop();
          return;
        }
        const speed = remainingPx / (remainingMs / 1000);
        posRef.current += speed * dt;
      } else {
        posRef.current += speedRef.current * dt;
      }

      el.scrollTop = posRef.current;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    },
    [scrollRef, stop],
  );

  const begin = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTsRef.current = 0;
    setIsScrolling(true);
    rafRef.current = requestAnimationFrame(step);
  }, [step]);

  const startSpeed = useCallback(
    (pxPerSec: number) => {
      modeRef.current = "speed";
      speedRef.current = pxPerSec;
      posRef.current = null; // seed from live position
      begin();
    },
    [begin],
  );

  const setSpeed = useCallback((pxPerSec: number) => {
    speedRef.current = pxPerSec;
  }, []);

  const startFollow = useCallback(
    (fraction: number, durationMs: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (max <= 0) return; // nothing scrollable on this device
      const pos = Math.min(1, Math.max(0, fraction)) * max;
      el.scrollTop = pos;
      posRef.current = pos;
      modeRef.current = "follow";
      endTimeRef.current = performance.now() + Math.max(0, durationMs);
      begin();
    },
    [scrollRef, begin],
  );

  const seekFollow = useCallback(
    (fraction: number, remainingMs: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (max <= 0) return;
      const pos = Math.min(1, Math.max(0, fraction)) * max;
      el.scrollTop = pos;
      posRef.current = pos;
      modeRef.current = "follow";
      endTimeRef.current = performance.now() + Math.max(0, remainingMs);
      if (!rafRef.current) begin();
    },
    [scrollRef, begin],
  );

  const metrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return { fraction: 0, max: 0, scrollTop: 0 };
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    const scrollTop = posRef.current ?? el.scrollTop;
    return {
      fraction: max > 0 ? Math.min(1, scrollTop / max) : 0,
      max,
      scrollTop,
    };
  }, [scrollRef]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { isScrolling, startSpeed, setSpeed, startFollow, seekFollow, stop, metrics };
}
