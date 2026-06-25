import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSettingsStore, useAppStore } from "@/store";
import { formatTime } from "@/lib/media";
import { Play, Pause, Gauge } from "lucide-react";

interface BottomScrollScrubberProps {
  scrollRef: RefObject<HTMLDivElement | null>;
}

const DRAG_THRESHOLD = 6;

export default function BottomScrollScrubber({
  scrollRef,
}: BottomScrollScrubberProps) {
  const {
    autoScrollSpeed,
    setAutoScrollSpeed,
    autoScrollMinSpeed,
    autoScrollMaxSpeed,
    autoScrollStartDelay,
  } = useSettingsStore();
  const { displayMode, setDisplayMode } = useAppStore();

  const [isScrolling, setIsScrolling] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [estSeconds, setEstSeconds] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const speedRef = useRef(autoScrollSpeed);
  const delayTimerRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; dragging: boolean }>({
    startX: 0,
    dragging: false,
  });

  useEffect(() => {
    speedRef.current = autoScrollSpeed;
  }, [autoScrollSpeed]);

  const range = Math.max(1, autoScrollMaxSpeed - autoScrollMinSpeed);
  const fillPct = Math.min(
    100,
    Math.max(0, ((autoScrollSpeed - autoScrollMinSpeed) / range) * 100),
  );

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
    // Multi-column / auto-fit layout cannot vertical-scroll; force scroll mode.
    if (displayMode !== "scroll") setDisplayMode("scroll");
    setIsScrolling(true);
    lastTsRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
  }, [displayMode, setDisplayMode, step]);

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

  // Keep the time estimate fresh whether idle or scrolling.
  useEffect(() => {
    const update = () => {
      const el = scrollRef.current;
      if (!el) return;
      const remainingPx = isScrolling
        ? Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop)
        : Math.max(0, el.scrollHeight - el.clientHeight);
      setEstSeconds(remainingPx / Math.max(1, autoScrollSpeed));
    };
    update();
    const id = window.setInterval(update, 500);
    return () => clearInterval(id);
  }, [scrollRef, autoScrollSpeed, isScrolling]);

  const applySpeedFromX = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = Math.round(
      autoScrollMinSpeed + ratio * (autoScrollMaxSpeed - autoScrollMinSpeed),
    );
    setAutoScrollSpeed(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    barRef.current?.setPointerCapture(e.pointerId);
    dragStateRef.current = { startX: e.clientX, dragging: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!barRef.current?.hasPointerCapture(e.pointerId)) return;
    if (
      !st.dragging &&
      Math.abs(e.clientX - st.startX) > DRAG_THRESHOLD
    ) {
      st.dragging = true;
    }
    if (st.dragging) applySpeedFromX(e.clientX);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    barRef.current?.releasePointerCapture(e.pointerId);
    if (!st.dragging) {
      toggle();
    }
    st.dragging = false;
  };

  const active = isScrolling || countdown > 0;

  return (
    <div
      ref={barRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`relative h-14 w-full shrink-0 border-t border-border cursor-pointer select-none touch-none overflow-hidden ${
        active ? "bg-primary/10" : "bg-card"
      }`}
      title="Tap to start/stop auto-scroll · drag to set speed"
    >
      {/* Speed fill */}
      <div
        className={`absolute inset-y-0 left-0 ${
          active ? "bg-primary/30" : "bg-muted"
        }`}
        style={{ width: `${fillPct}%` }}
      />

      <div className="relative h-full flex items-center justify-between px-4 pointer-events-none">
        <div className="flex items-center gap-2">
          {active ? (
            <Pause className="w-5 h-5 text-primary" />
          ) : (
            <Play className="w-5 h-5 text-muted-foreground ml-0.5" />
          )}
          <span className="text-sm font-medium">
            {countdown > 0
              ? `Starting in ${countdown}…`
              : active
                ? "Auto-scrolling"
                : "Auto-scroll"}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1 font-mono">
            <Gauge className="w-4 h-4" />
            {autoScrollSpeed}
          </span>
          <span className="font-mono tabular-nums">
            ≈ {formatTime(estSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}
