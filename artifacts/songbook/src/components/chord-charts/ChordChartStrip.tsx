import { Guitar, Piano, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Instrument } from "@/store";
import ChordDiagram from "./ChordDiagram";

interface Props {
  chords: string[];
  instrument: Instrument;
  onToggleInstrument: () => void;
  frozen: boolean;
  onToggleFrozen: () => void;
}

const CARD_W = 72;

export default function ChordChartStrip({
  chords,
  instrument,
  onToggleInstrument,
  frozen,
  onToggleFrozen,
}: Props) {
  if (chords.length === 0) return null;

  return (
    <div className="shrink-0 flex items-stretch border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="flex shrink-0 flex-col justify-center gap-1 border-r border-border px-1.5 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onToggleInstrument();
          }}
          title={instrument === "guitar" ? "Show piano charts" : "Show guitar charts"}
          aria-label="Toggle chord chart instrument"
        >
          {instrument === "guitar" ? (
            <Guitar className="h-4 w-4 text-primary" />
          ) : (
            <Piano className="h-4 w-4 text-primary" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFrozen();
          }}
          title={frozen ? "Unpin chord charts" : "Pin chord charts while scrolling"}
          aria-label="Toggle pin chord charts"
          aria-pressed={frozen}
        >
          {frozen ? (
            <Pin className="h-4 w-4 text-primary" />
          ) : (
            <PinOff className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex gap-2 px-2 py-1.5">
          {chords.map((chord) => (
            <div
              key={chord}
              className="flex shrink-0 flex-col items-center gap-1"
              style={{ width: CARD_W }}
            >
              <span
                className="max-w-full truncate text-xs font-bold leading-none text-primary"
                title={chord}
              >
                {chord}
              </span>
              <ChordDiagram symbol={chord} instrument={instrument} width={CARD_W - 8} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
