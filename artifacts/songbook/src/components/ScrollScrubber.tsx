import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSettingsStore } from "@/store";
import { Play, Pause } from "lucide-react";

interface ScrollScrubberProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  songId: string;
}

const DRAG_THRESHOLD = 5;

/** Speed (px/s) → handle position 0..1, with the base speed pinned dead-center. */
function speedToPos(speed: number, min: number, base: number, max: number) {
  if (speed <= base) {
    return base > min ? 0.5 * ((speed - min) / (base - min)) : 0;
  }
  return max > base ? 0.5 + 0.5 * ((speed - base) / (max - base)) : 1;
}

/** Handle position 0..1 → speed (px/s); center maps back to the base speed. */
function posToSpeed(pos: number, min: number, base: number, max: number) {
  const r = Math.min(1, Math.max(0, pos));
  const speed =
    r <= 0.5 ? min + (r / 0.5) * (base - min) : base + ((r - 0.5) / 0.5) * (max - base);
  return Math.round(speed);
}

export default function ScrollScrubber({
  scrollRef,
  songId,
}: ScrollScrubberProps) {
  const {
    autoScrollSpeed,
    autoScrollMinSpeed,
    autoScrollMaxSpeed,
    autoScrollStartDelay,
    songScrollSpeeds,
    setSongScrollSpeed,
  } = useSettingsStore();

  const base = autoScrollSpeed;
  const min = autoScrollMinSpeed;
  const max = autoScrollMaxSpeed;

  const currentSpeed = Math.min(
    max,
    Math.max(min, songScrollSpeeds[songId] ?? base),
  );

  const [isScrolling, setIsScrolling] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const speedRef = useRef(currentSpeed);
  const delayTimerRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; dragging: boolean }>({
    startX: 0,
    dragging: false,
  });

  useEffect(() => {
    speedRef.current = currentSpeed;
  }, [currentSpeed]);

  const pos = speedToPos(currentSpeed, min, base, max);
  const multiplier = base > 0 ? currentSpeed / base : 1;

  const stop = useCallback(() => {
    setIsScrolling(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = 0;
  }, []);

  const step = useCallback(
    (ts: number) => {
      const el = scrollRef.current;
      if (!el) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      el.scrollTop += speedRef.current * dt;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    },
    [scrollRef, stop],
  );

  const begin = useCallback(() => {
    setIsScrolling(true);
    lastTsRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
  }, [step]);

  const start = useCallback(() => {
    if (autoScrollStartDelay > 0) {
      setCountdown(autoScrollStartDelay);
      let remaining = autoScrollStartDelay;
      delayTimerRef.current = window.setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (delayTimerRef.current) clearInterval(delayTimerRef.current);
          delayTimerRef.current = null;
          begin();
        }
      }, 1000);
    } else {
      begin();
    }
  }, [autoScrollStartDelay, begin]);

  const toggle = useCallback(() => {
    if (isScrolling || countdown > 0) {
      if (delayTimerRef.current) {
        clearInterval(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      setCountdown(0);
      stop();
    } else {
      start();
    }
  }, [isScrolling, countdown, start, stop]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    };
  }, []);

  const applySpeedFromX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const next = posToSpeed(ratio, min, base, max);
    speedRef.current = next;
    setSongScrollSpeed(songId, next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    trackRef.current?.setPointerCapture(e.pointerId);
    dragStateRef.current = { startX: e.clientX, dragging: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!trackRef.current?.hasPointerCapture(e.pointerId)) return;
    if (!st.dragging && Math.abs(e.clientX - st.startX) > DRAG_THRESHOLD) {
      st.dragging = true;
    }
    if (st.dragging) applySpeedFromX(e.clientX);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    trackRef.current?.releasePointerCapture(e.pointerId);
    if (!st.dragging) toggle();
    st.dragging = false;
  };

  const active = isScrolling || countdown > 0;

  return (
    <div className="relative h-20 w-full shrink-0 border-b border-border bg-card select-none">
      {/* Edge + center labels */}
      <div className="absolute inset-x-6 top-2 flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground pointer-events-none">
        <span>Slower</span>
        <span className={active ? "text-primary" : ""}>
          {countdown > 0
            ? `Starting in ${countdown}…`
            : `${multiplier.toFixed(2)}×`}
        </span>
        <span>Faster</span>
      </div>

      {/* Track + draggable circular handle */}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="absolute left-8 right-8 top-1/2 mt-1 -translate-y-1/2 h-1.5 rounded-full bg-muted touch-none cursor-pointer"
      >
        {/* Center (1×) tick */}
        <div className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border" />

        {/* Fill from center to the handle */}
        <div
          className={`absolute top-0 h-full rounded-full ${active ? "bg-primary/50" : "bg-foreground/20"}`}
          style={{
            left: `${Math.min(50, pos * 100)}%`,
            right: `${Math.max(0, 100 - Math.max(50, pos * 100))}%`,
          }}
        />

        {/* Circular Scroll button — lights up when active */}
        <button
          type="button"
          aria-label={active ? "Stop auto-scroll" : "Start auto-scroll"}
          aria-pressed={active}
          className={`absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg transition-all ${
            active
              ? "bg-primary text-primary-foreground ring-4 ring-primary/30 scale-105"
              : "bg-card border border-border text-foreground"
          }`}
          style={{ left: `${pos * 100}%` }}
        >
          {active ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
