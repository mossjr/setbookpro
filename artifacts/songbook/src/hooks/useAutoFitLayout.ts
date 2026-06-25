import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const Z_MIN = 0.5;
const Z_MAX = 3;
const N_MAX = 6;
const GAP = 32; // px — must match the columnGap applied to the song body

interface Options {
  /** Active only in the auto-fit display mode. */
  enabled: boolean;
  /** The scrollable song-body viewport. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** A hidden mirror of the song rendered at zoom 1, used purely for measuring. */
  measureRef: RefObject<HTMLDivElement | null>;
  /** Lyrics wrap; chord+lyric lines do not — this changes the width constraint. */
  lyricsOnly: boolean;
  /** Changes (song / transpose / font sizes / lyricsOnly) trigger a re-fit. */
  recomputeKey: string;
}

interface Result {
  columnCount: number;
  zoom: number;
  /** Drop any manual override and re-run the optimizer. */
  refit: () => void;
  /** Manually adjust zoom; pauses automatic re-fitting until the next re-fit. */
  nudgeZoom: (delta: number) => void;
}

/**
 * Picks the column count (1..N) and font zoom that show the WHOLE song without
 * scrolling while keeping the font as large as possible.
 *
 * It measures the song's CSS-balanced height for each candidate column count on
 * a hidden node (rendered at zoom 1), derives the largest zoom that still fits
 * both vertically and — in chord mode, where lines do not wrap — horizontally,
 * applies the best (columns, zoom), then refines on the real DOM to absorb any
 * non-linearity (balancing slack, fixed margins, lyric wrapping).
 */
export function useAutoFitLayout({
  enabled,
  scrollRef,
  measureRef,
  lyricsOnly,
  recomputeKey,
}: Options): Result {
  const [columnCount, setColumnCount] = useState(1);
  const [zoom, setZoom] = useState(1);

  const manualRef = useRef(false); // user nudged zoom → pause auto re-fit
  const fittingRef = useRef(false); // a fit pass is currently in flight
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const lyricsOnlyRef = useRef(lyricsOnly);
  lyricsOnlyRef.current = lyricsOnly;

  const compute = useCallback((): { n: number; z: number } | null => {
    const scroll = scrollRef.current;
    const m = measureRef.current;
    if (!scroll || !m) return null;

    const cs = getComputedStyle(scroll);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availW = scroll.clientWidth - padX;
    const availH = scroll.clientHeight - padY;
    if (availW <= 0 || availH <= 0) return null;

    const lo = lyricsOnlyRef.current;

    m.style.columnGap = `${GAP}px`;
    m.style.columnFill = "balance";

    // Widest unwrapped line (chord mode only — lyrics wrap, so width is not the
    // binding constraint there). Shrink-wrap the node to read its max-content.
    let w1 = 0;
    if (!lo) {
      m.style.display = "inline-block";
      m.style.columnCount = "1";
      m.style.width = "auto";
      w1 = Math.ceil(m.getBoundingClientRect().width);
    }
    m.style.display = "block";
    m.style.width = `${availW}px`;

    let best = { n: 1, z: Z_MIN };
    for (let n = 1; n <= N_MAX; n++) {
      const colW = (availW - (n - 1) * GAP) / n;
      if (colW <= 0) break;
      // A column that can't hold the widest line even at min zoom is pointless.
      if (!lo && w1 > 0 && colW < w1 * Z_MIN) continue;

      m.style.columnCount = String(n);
      const hn1 = m.scrollHeight; // CSS-balanced height at zoom 1 for n columns
      if (hn1 <= 0) continue;

      const zH = availH / hn1;
      const zW = !lo && w1 > 0 ? colW / w1 : Infinity;
      const z = Math.max(Z_MIN, Math.min(Z_MAX, Math.min(zH, zW)));
      // Ascending n means ties keep the smaller column count (more readable).
      if (z > best.z + 0.001) best = { n, z };
    }

    return { n: best.n, z: Math.max(Z_MIN, Math.floor(best.z * 100) / 100) };
  }, [scrollRef, measureRef]);

  const applyAndRefine = useCallback(() => {
    const res = compute();
    if (!res) return;
    setColumnCount(res.n);
    setZoom(res.z);

    fittingRef.current = true;
    let passes = 3;
    const refine = () => {
      const scroll = scrollRef.current;
      if (!scroll || !enabledRef.current) {
        fittingRef.current = false;
        return;
      }
      const cs = getComputedStyle(scroll);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = scroll.clientWidth - padX;
      const availH = scroll.clientHeight - padY;
      const contentH = scroll.scrollHeight - padY;
      const contentW = scroll.scrollWidth - padX;
      const overflowing = contentH > availH + 1 || contentW > availW + 1;

      if (overflowing && passes > 0) {
        passes--;
        const ratio = Math.min(
          availH / Math.max(1, contentH),
          availW / Math.max(1, contentW),
        );
        setZoom((z) => {
          const nz = Math.max(
            Z_MIN,
            Math.floor(z * Math.min(1, ratio) * 100) / 100,
          );
          return nz >= z ? z : nz;
        });
        requestAnimationFrame(refine);
      } else {
        scroll.scrollTop = 0;
        fittingRef.current = false;
      }
    };
    requestAnimationFrame(refine);
  }, [compute, scrollRef]);

  // Re-fit after the hidden measurer renders for the current content/viewport.
  useLayoutEffect(() => {
    if (!enabled) return;
    manualRef.current = false;
    applyAndRefine();
  }, [enabled, applyAndRefine, recomputeKey]);

  // Re-fit on viewport resize (debounced), unless the user took manual control.
  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      if (manualRef.current || fittingRef.current) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => applyAndRefine(), 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [enabled, applyAndRefine, scrollRef]);

  // Web-font metrics can shift after first paint — re-fit once they're ready.
  useEffect(() => {
    if (!enabled || !document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled && !manualRef.current) applyAndRefine();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, applyAndRefine]);

  const refit = useCallback(() => {
    manualRef.current = false;
    applyAndRefine();
  }, [applyAndRefine]);

  const nudgeZoom = useCallback((delta: number) => {
    manualRef.current = true;
    setZoom((z) =>
      Math.max(Z_MIN, Math.min(Z_MAX, Math.round((z + delta) * 100) / 100)),
    );
  }, []);

  return { columnCount, zoom, refit, nudgeZoom };
}
