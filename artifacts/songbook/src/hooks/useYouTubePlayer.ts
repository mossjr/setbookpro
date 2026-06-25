import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import { loadYouTubeApi } from "@/lib/youtube";

export interface YouTubeController {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  ready: boolean;
  hasSource: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
}

/**
 * Controls a YouTube IFrame player. The iframe is created imperatively inside
 * the provided wrapper (kept outside React's reconciliation) to avoid the
 * "removeChild" conflicts that arise when YT replaces a React-managed node.
 */
export function useYouTubePlayer(
  wrapperRef: RefObject<HTMLDivElement | null>,
  videoId: string | null,
): YouTubeController {
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !videoId) return;
    let cancelled = false;

    const target = document.createElement("div");
    wrapper.appendChild(target);

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const w = window as any;
      playerRef.current = new w.YT.Player(target, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setReady(true);
            setDuration(playerRef.current?.getDuration?.() || 0);
          },
          onStateChange: (e: any) => {
            const YT = w.YT;
            setIsPlaying(e.data === YT.PlayerState.PLAYING);
            if (e.data === YT.PlayerState.PLAYING) {
              setDuration(playerRef.current?.getDuration?.() || 0);
            }
          },
        },
      });
    });

    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (p && p.getCurrentTime) {
        setCurrentTime(p.getCurrentTime() || 0);
        const d = p.getDuration?.() || 0;
        if (d) setDuration(d);
      }
    }, 250);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      wrapper.innerHTML = "";
      setReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    };
  }, [wrapperRef, videoId]);

  const play = useCallback(() => playerRef.current?.playVideo?.(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), []);
  const toggle = useCallback(() => {
    if (isPlaying) playerRef.current?.pauseVideo?.();
    else playerRef.current?.playVideo?.();
  }, [isPlaying]);
  const seek = useCallback((time: number) => {
    playerRef.current?.seekTo?.(time, true);
    setCurrentTime(time);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    ready,
    hasSource: !!videoId,
    play,
    pause,
    toggle,
    seek,
  };
}
