import { getPianoNotes } from "@/lib/chordTheory";
import { getGuitarVoicing } from "@/lib/guitarChords";
import type { Instrument } from "@/store";
import PianoChordDiagram from "./PianoChordDiagram";
import GuitarChordDiagram from "./GuitarChordDiagram";

interface Props {
  symbol: string;
  instrument: Instrument;
  width?: number;
}

function NoDiagram({
  width,
  instrument,
}: {
  width: number;
  instrument: Instrument;
}) {
  const height = instrument === "piano" ? width * 0.42 : width;
  return (
    <div
      style={{ width, height }}
      className="flex items-center justify-center rounded border border-dashed border-border text-muted-foreground text-xs"
      title="No diagram available"
    >
      —
    </div>
  );
}

export default function ChordDiagram({ symbol, instrument, width = 84 }: Props) {
  if (instrument === "piano") {
    const piano = getPianoNotes(symbol);
    if (!piano) return <NoDiagram width={width} instrument={instrument} />;
    return (
      <PianoChordDiagram
        notes={piano.notes}
        rootPc={piano.rootPc}
        bassPc={piano.bassPc}
        width={width}
      />
    );
  }

  const voicing = getGuitarVoicing(symbol);
  if (!voicing) return <NoDiagram width={width} instrument={instrument} />;
  return <GuitarChordDiagram position={voicing} width={width} />;
}
