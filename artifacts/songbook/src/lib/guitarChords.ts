import guitarDbRaw from "@tombatossals/chords-db/lib/guitar.json";
import { parseChordSymbol } from "./chords";
import { normalizeQuality, CANONICAL_TO_DB_SUFFIX } from "./chordTheory";

export interface GuitarPosition {
  /** Fret per string, low-E (6th) -> high-E (1st). -1 = muted, 0 = open. */
  frets: number[];
  /** Finger per string (1-4), 0 = none. Parallel to `frets`. */
  fingers: number[];
  /** Fret offset of the displayed window (1 = at the nut). */
  baseFret: number;
  /** Relative fret numbers that are barred. */
  barres: number[];
  capo?: boolean;
}

interface GuitarDb {
  keys: string[];
  suffixes: string[];
  chords: Record<
    string,
    { key: string; suffix: string; positions: GuitarPosition[] }[]
  >;
}

const guitarDb = guitarDbRaw as unknown as GuitarDb;

// Pitch class -> dataset object key. The `keys` array is chromatic from C
// ("C","C#","D","Eb",...); the chords object keys spell "#" as "sharp".
const PC_TO_DBKEY = guitarDb.keys.map((k) => k.replace("#", "sharp"));

// Bass-note spelling used by the dataset's slash suffixes (e.g. "/F#", "/Bb").
const PC_TO_SLASH_BASS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B",
];

function lookupPositions(dbKey: string, suffix: string): GuitarPosition[] | null {
  const list = guitarDb.chords[dbKey];
  if (!list) return null;
  const entry = list.find((c) => c.suffix === suffix);
  return entry ? entry.positions : null;
}

/**
 * Resolve a chord symbol to a single guitar voicing (the dataset's first /
 * easiest position), or null when the dataset has no entry — in which case the
 * UI shows an explicit "no diagram" state.
 */
export function getGuitarVoicing(symbol: string): GuitarPosition | null {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;

  const dbKey = PC_TO_DBKEY[parsed.rootPc];
  if (!dbKey) return null;

  const canonical = normalizeQuality(parsed.quality);
  if (!canonical) return null;

  // Slash chords over a plain major/minor triad: try a dedicated slash voicing
  // first, then fall back to the base shape (same chord, different bass).
  if (parsed.bassPc !== null && (canonical === "maj" || canonical === "min")) {
    const bassName = PC_TO_SLASH_BASS[parsed.bassPc];
    const slashSuffix = (canonical === "min" ? "m" : "") + "/" + bassName;
    const slashPositions = lookupPositions(dbKey, slashSuffix);
    if (slashPositions && slashPositions.length) return slashPositions[0];
  }

  const suffix = CANONICAL_TO_DB_SUFFIX[canonical];
  if (!suffix) return null;

  const positions = lookupPositions(dbKey, suffix);
  if (!positions || !positions.length) return null;
  return positions[0];
}
