import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

// Zoom is USER-controlled; these only bound the width-safe clamp.
const Z_MIN = 0.5;
const Z_MAX = 3;

/** Small fixed gutter between columns — does NOT grow with font size. */
export const GAP = 24;
/** Inset between the music area edges and the content, applied in both modes. */
export const EDGE = 16;

// Safety pad so a column is always at least as wide as the widest chord line.
const COL_PAD = 10;
// A "comfortable" reading column, derived from the lyric font size.
const READABLE_MIN = 280;
const READABLE_MAX = 620;
const READABLE_FACTOR = 22;

export type EffectiveMode = "scroll" | "split";

interface Options {
  /** User-selected mode. 'auto' resolves to scroll or split by available width. */
  displayMode: "scroll" | "split" | "auto";
  /** User-controlled zoom multiplier (from the store). */
  userZoom: number;
  /** Lyrics wrap; chord+lyric lines do not — changes the width constraint. */
  lyricsOnly: boolean;
  /** Base lyric font size (px) — drives the comfortable column width. */
  lyricsFontSize: number;
  /** The full music area; its content box gives the available width/height. */
  frameRef: RefObject<HTMLDivElement | null>;
  /** The multi-column element (split mode only), measured for page count. */
  pagerRef: RefObject<HTMLDivElement | null>;
  /** Hidden zoom-1 mirror (chord mode) used to measure the widest line. */
  measureRef: RefObject<HTMLDivElement | null>;
  /** Any change here (song/transpose/font/zoom/mode) triggers a reflow. */
  recomputeKey: string;
  /** Horizontal safe-zone insets (px) reserved for overlay UI on each side, so
   *  content never renders under the reveal tab (left) or floating controls
   *  (right). Added to EDGE in both the CSS padding and this width math. */
  safeLeft?: number;
  safeRight?: number;
}

interface Layout {
  effectiveMode: EffectiveMode;
  effectiveZoom: number;
  columnGap: number;
  columnWidth: number;
  columnsPerPage: number;
  pageWidth: number;
}

interface Result extends Layout {
  pageCount: number;
  pageIndex: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (i: number) => void;
}

/**
 * Computes a reflowing, user-zoom layout for the song body:
 *  - SCROLL: one column; content never wider than the viewport (width-safe zoom).
 *  - SPLIT: evenly-spaced paginated columns with a small fixed gutter; pages turn
 *    horizontally. Each column is guaranteed wide enough for the widest chord
 *    line, so nothing ever overflows horizontally.
 *  - AUTO: picks SCROLL when only one comfortable column fits, else SPLIT.
 *
 * Reflows on zoom/font/mode/viewport/font-ready changes.
 */
export function useSongViewLayout({
  displayMode,
  userZoom,
  lyricsOnly,
  lyricsFontSize,
  frameRef,
  pagerRef,
  measureRef,
  recomputeKey,
  safeLeft = 0,
  safeRight = 0,
}: Options): Result {
  const [layout, setLayout] = useState<Layout>({
    effectiveMode: displayMode === "split" ? "split" : "scroll",
    effectiveZoom: userZoom,
    columnGap: GAP,
    columnWidth: 0,
    columnsPerPage: 1,
    pageWidth: 0,
  });
  const [pageCount, setPageCount] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);

  const compute = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const availW = frame.clientWidth - 2 * EDGE - safeLeft - safeRight;
    const availH = frame.clientHeight - 2 * EDGE;
    if (availW <= 0 || availH <= 0) return;

    // Widest unwrapped line at zoom 1 (chord mode only — lyrics wrap).
    let widest1 = 0;
    if (!lyricsOnly && measureRef.current) {
      widest1 = Math.ceil(measureRef.current.getBoundingClientRect().width);
    }

    // The hard guard against horizontal overflow: never let the widest line
    // exceed the available width. Width safety ALWAYS WINS — effZoom is capped
    // at widthSafeZoom unconditionally (it can drop below the Z_MIN readability
    // floor for a line wider than the viewport at Z_MIN). availW is guaranteed
    // > 0 here (early return above), so widthSafeZoom is finite & positive when
    // it applies. effZoom <= widthSafeZoom => widestEff <= availW, always.
    const widthSafeZoom =
      !lyricsOnly && widest1 > 0 ? availW / widest1 : Infinity;
    const desired = Math.min(Z_MAX, userZoom);
    const floor = Math.min(Z_MIN, widthSafeZoom);
    const effZoom = Math.max(floor, Math.min(desired, widthSafeZoom));

    const widestEff = widest1 * effZoom;
    const readable = Math.min(
      READABLE_MAX,
      Math.max(READABLE_MIN, lyricsFontSize * effZoom * READABLE_FACTOR),
    );
    let comfortable = lyricsOnly
      ? readable
      : Math.max(widestEff + COL_PAD, readable);
    comfortable = Math.min(comfortable, availW);

    const cpp = Math.max(
      1,
      Math.floor((availW + GAP) / (comfortable + GAP)),
    );

    let mode: EffectiveMode;
    if (displayMode === "scroll") mode = "scroll";
    else if (displayMode === "split") mode = "split";
    else mode = cpp >= 2 ? "split" : "scroll";

    const colsPerPage = mode === "split" ? cpp : 1;
    const colW =
      mode === "split" ? (availW - (cpp - 1) * GAP) / cpp : availW;

    setLayout({
      effectiveMode: mode,
      effectiveZoom: effZoom,
      columnGap: GAP,
      columnWidth: colW,
      columnsPerPage: colsPerPage,
      pageWidth: availW + GAP,
    });
  }, [
    frameRef,
    measureRef,
    displayMode,
    userZoom,
    lyricsOnly,
    lyricsFontSize,
    safeLeft,
    safeRight,
  ]);

  // Reflow when content/zoom/mode/font changes; reset to the first page.
  useLayoutEffect(() => {
    setPageIndex(0);
    compute();
  }, [compute, recomputeKey]);

  // After the columns render, measure how many pages the content spans.
  useEffect(() => {
    if (layout.effectiveMode !== "split") {
      setPageCount(1);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const pager = pagerRef.current;
      if (!pager) return;
      const colUnit = layout.columnWidth + layout.columnGap;
      const total = pager.scrollWidth;
      const totalCols =
        colUnit > 0
          ? Math.max(1, Math.round((total + layout.columnGap) / colUnit))
          : 1;
      const pages = Math.max(
        1,
        Math.ceil(totalCols / Math.max(1, layout.columnsPerPage)),
      );
      setPageCount(pages);
      setPageIndex((p) => Math.min(p, pages - 1));
    });
    return () => cancelAnimationFrame(raf);
  }, [pagerRef, layout, recomputeKey]);

  // Reflow on viewport resize (debounced).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => compute(), 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [frameRef, compute]);

  // Web-font metrics can shift after first paint — reflow once ready.
  useEffect(() => {
    if (!document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) compute();
    });
    return () => {
      cancelled = true;
    };
  }, [compute]);

  const goToPage = useCallback(
    (i: number) => setPageIndex(Math.max(0, Math.min(i, pageCount - 1))),
    [pageCount],
  );
  const nextPage = useCallback(
    () => setPageIndex((p) => Math.min(p + 1, pageCount - 1)),
    [pageCount],
  );
  const prevPage = useCallback(() => setPageIndex((p) => Math.max(p - 1, 0)), []);

  return {
    ...layout,
    pageCount,
    pageIndex,
    nextPage,
    prevPage,
    goToPage,
  };
}
