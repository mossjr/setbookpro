import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Square, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSettingsStore } from "@/store";

export default function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const { metronomeFlash, metronomeSound } = useSettingsStore();
  const flashRef = useRef(metronomeFlash);
  const soundRef = useRef(metronomeSound);
  useEffect(() => {
    flashRef.current = metronomeFlash;
  }, [metronomeFlash]);
  useEffect(() => {
    soundRef.current = metronomeSound;
  }, [metronomeSound]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const current16thNoteRef = useRef<number>(0);
  const timerIDRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
  };

  const triggerFlash = useCallback(() => {
    setFlashOn(true);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlashOn(false), 90);
  }, []);

  const nextNote = useCallback(() => {
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTimeRef.current += 0.25 * secondsPerBeat;
    current16thNoteRef.current++;
    if (current16thNoteRef.current === 4) {
      current16thNoteRef.current = 0;
    }
  }, [bpm]);

  const scheduleNote = useCallback(
    (beatNumber: number, time: number) => {
      if (beatNumber % 4 !== 0) return;
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (soundRef.current) {
        const osc = ctx.createOscillator();
        const envelope = ctx.createGain();
        osc.frequency.value = beatNumber === 0 ? 880.0 : 440.0;
        envelope.gain.value = 1;
        envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        osc.connect(envelope);
        envelope.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.03);
      }

      if (flashRef.current) {
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        window.setTimeout(triggerFlash, delayMs);
      }
    },
    [triggerFlash],
  );

  const scheduler = useCallback(() => {
    if (!audioContextRef.current) return;
    while (
      nextNoteTimeRef.current <
      audioContextRef.current.currentTime + 0.1
    ) {
      scheduleNote(current16thNoteRef.current, nextNoteTimeRef.current);
      nextNote();
    }
    timerIDRef.current = requestAnimationFrame(scheduler);
  }, [nextNote, scheduleNote]);

  useEffect(() => {
    if (isPlaying) {
      if (!audioContextRef.current) {
        initAudio();
      }
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }
      nextNoteTimeRef.current = audioContextRef.current!.currentTime + 0.05;
      scheduler();
    } else {
      if (timerIDRef.current !== null) {
        cancelAnimationFrame(timerIDRef.current);
      }
    }
    return () => {
      if (timerIDRef.current !== null) {
        cancelAnimationFrame(timerIDRef.current);
      }
    };
  }, [isPlaying, scheduler]);

  return (
    <>
      {flashOn && (
        <div className="fixed inset-0 z-[100] pointer-events-none bg-primary/30" />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={isPlaying ? "default" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-card"
            title="Metronome"
          >
            {isPlaying ? (
              <Square className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" align="end" className="w-64">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Metronome</h4>
              <span className="font-mono bg-muted px-2 py-1 rounded text-sm">
                {bpm} BPM
              </span>
            </div>
            <Slider
              value={[bpm]}
              min={40}
              max={240}
              step={1}
              onValueChange={([val]) => setBpm(val)}
            />
            <Button
              className="w-full"
              variant={isPlaying ? "destructive" : "default"}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? "Stop" : "Start"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Sound &amp; flash toggles are in Settings.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
