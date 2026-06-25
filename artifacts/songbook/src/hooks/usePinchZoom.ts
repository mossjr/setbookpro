import { useEffect, useRef, type RefObject } from "react";

interface Options {
  /** The element that receives the touch listeners (the whole music area). */
  frameRef: RefObject<HTMLElement | null>;
  /** Only bind once the song body is mounted. */
  enabled: boolean;
  /** The element to scale live during the pinch (cleared on release). */
  getStage: () => HTMLElement | null;
  /** Current committed zoom multiplier. */
  getZoom: () => number;
  /** Commit a new zoom on release — triggers the reflow. */
  setZoom: (z: number) => void;
  min?: number;
  max?: number;
}

/**
 * Two-finger pinch-to-zoom for touch screens. During the gesture we apply a CSS
 * `scale()` to the stage element for instant, smooth visual feedback (the
 * "canvas" zoom). On release we commit the resulting zoom to the store, which
 * reflows the layout at the new size. Single-finger touches are left untouched
 * so native scrolling keeps working.
 */
export function usePinchZoom({
  frameRef,
  enabled,
  getStage,
  getZoom,
  setZoom,
  min = 0.5,
  max = 3,
}: Options) {
  // Latest callbacks/values, read at gesture time without re-binding listeners.
  const latest = useRef({ getStage, getZoom, setZoom, min, max });
  latest.current = { getStage, getZoom, setZoom, min, max };

  const gesture = useRef({
    active: false,
    startDist: 1,
    startZoom: 1,
    visual: 1,
    stage: null as HTMLElement | null,
  });

  useEffect(() => {
    if (!enabled) return;
    const frame = frameRef.current;
    if (!frame) return;

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const clearStage = (stage: HTMLElement | null) => {
      if (!stage) return;
      stage.style.transform = "";
      stage.style.transformOrigin = "";
      stage.style.willChange = "";
    };

    const end = (commit: boolean) => {
      const g = gesture.current;
      if (!g.active) return;
      g.active = false;
      clearStage(g.stage);
      if (commit) {
        const { setZoom, min, max } = latest.current;
        const target = Math.min(max, Math.max(min, g.startZoom * g.visual));
        setZoom(Math.round(target * 100) / 100);
      }
      g.stage = null;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const stage = latest.current.getStage();
      if (!stage) return;
      const [a, b] = [e.touches[0], e.touches[1]];
      const g = gesture.current;
      g.active = true;
      g.startDist = dist(a, b) || 1;
      g.startZoom = latest.current.getZoom();
      g.visual = 1;
      g.stage = stage;
      const rect = stage.getBoundingClientRect();
      const midX = (a.clientX + b.clientX) / 2 - rect.left;
      const midY = (a.clientY + b.clientY) / 2 - rect.top;
      stage.style.transformOrigin = `${midX}px ${midY}px`;
      stage.style.willChange = "transform";
      e.preventDefault();
    };

    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g.active || e.touches.length < 2) return;
      e.preventDefault();
      const { min, max } = latest.current;
      const d = dist(e.touches[0], e.touches[1]);
      const lo = min / g.startZoom;
      const hi = max / g.startZoom;
      g.visual = Math.min(hi, Math.max(lo, d / g.startDist));
      if (g.stage) g.stage.style.transform = `scale(${g.visual})`;
    };

    const onEnd = (e: TouchEvent) => {
      if (!gesture.current.active) return;
      if (e.touches.length >= 2) return; // still pinching with 2+ fingers
      end(true);
    };

    const onCancel = () => end(false);

    frame.addEventListener("touchstart", onStart, { passive: false });
    frame.addEventListener("touchmove", onMove, { passive: false });
    frame.addEventListener("touchend", onEnd);
    frame.addEventListener("touchcancel", onCancel);
    return () => {
      end(false);
      frame.removeEventListener("touchstart", onStart);
      frame.removeEventListener("touchmove", onMove);
      frame.removeEventListener("touchend", onEnd);
      frame.removeEventListener("touchcancel", onCancel);
    };
  }, [frameRef, enabled]);
}
