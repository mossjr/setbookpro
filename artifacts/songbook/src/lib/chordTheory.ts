import { parseChordSymbol } from "./chords";

// ---------------------------------------------------------------------------
// Chord quality model
//
// Every supported quality is reduced to a single canonical key. From that key
// we derive both the piano pitch-class set (computed here) and the guitar
// dictionary suffix (see guitarChords.ts). Unknown qualities return null so the
// UI can show an explicit "no diagram" state rather than faking one.
// ---------------------------------------------------------------------------

/** Canonical quality key -> pitch-class offsets from the root (mod 12). */
const CANONICAL_INTERVALS: Record<string, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  "6": [0, 4, 7, 9],
  "69": [0, 2, 4, 7, 9],
  "7": [0, 4, 7, 10],
  "7b5": [0, 4, 6, 10],
  "9": [0, 2, 4, 7, 10],
  "11": [0, 2, 5, 7, 10],
  "13": [0, 2, 4, 7, 9, 10],
  maj7: [0, 4, 7, 11],
  maj9: [0, 2, 4, 7, 11],
  maj11: [0, 2, 4, 5, 7, 11],
  maj13: [0, 2, 4, 7, 9, 11],
  m6: [0, 3, 7, 9],
  m69: [0, 2, 3, 7, 9],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  m9: [0, 2, 3, 7, 10],
  m11: [0, 2, 3, 5, 7, 10],
  mmaj7: [0, 3, 7, 11],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
  "5": [0, 7],
};

/** Canonical quality key -> @tombatossals/chords-db suffix. */
export const CANONICAL_TO_DB_SUFFIX: Record<string, string> = {
  maj: "major",
  min: "minor",
  dim: "dim",
  dim7: "dim7",
  aug: "aug",
  sus2: "sus2",
  sus4: "sus4",
  "7sus4": "7sus4",
  "6": "6",
  "69": "69",
  "7": "7",
  "7b5": "7b5",
  "9": "9",
  "11": "11",
  "13": "13",
  maj7: "maj7",
  maj9: "maj9",
  maj11: "maj11",
  maj13: "maj13",
  m6: "m6",
  m69: "m69",
  m7: "m7",
  m7b5: "m7b5",
  m9: "m9",
  m11: "m11",
  mmaj7: "mmaj7",
  add9: "add9",
  madd9: "madd9",
  // "5" (power chord) intentionally absent — no guitar voicing in the dataset.
};

// Case-SENSITIVE forms (the only place where "M" vs "m" matters).
const EXACT: Record<string, string> = {
  M: "maj",
  M6: "6",
  M7: "maj7",
  M9: "maj9",
  M11: "maj11",
  M13: "maj13",
  Maj: "maj",
  Maj7: "maj7",
  Maj9: "maj9",
  m: "min",
  m6: "m6",
  m7: "m7",
  m9: "m9",
  m11: "m11",
  m69: "m69",
  m7b5: "m7b5",
  mM7: "mmaj7",
  mMaj7: "mmaj7",
};

// Case-INSENSITIVE forms (looked up after lowercasing).
const LOWER: Record<string, string> = {
  maj: "maj",
  major: "maj",
  ma: "maj",
  min: "min",
  mi: "min",
  minor: "min",
  "-": "min",
  dim: "dim",
  dim7: "dim7",
  aug: "aug",
  aug5: "aug",
  sus: "sus4",
  sus4: "sus4",
  sus2: "sus2",
  "7sus4": "7sus4",
  "7sus": "7sus4",
  "6": "6",
  add6: "6",
  maj6: "6",
  "69": "69",
  "6/9": "69",
  "6add9": "69",
  "7": "7",
  dom7: "7",
  dom: "7",
  "7b5": "7b5",
  "7-5": "7b5",
  "9": "9",
  add9: "add9",
  "11": "11",
  "13": "13",
  maj7: "maj7",
  maj9: "maj9",
  maj11: "maj11",
  maj13: "maj13",
  min7: "m7",
  min9: "m9",
  min11: "m11",
  min6: "m6",
  min7b5: "m7b5",
  "-7": "m7",
  "-9": "m9",
  "-6": "m6",
  minmaj7: "mmaj7",
  "min/maj7": "mmaj7",
  "-maj7": "mmaj7",
  mmaj7: "mmaj7",
  madd9: "madd9",
  m69: "m69",
  "5": "5",
  no3: "5",
  omit3: "5",
};

/**
 * Reduce a raw chord quality string (e.g. "m7", "Maj7", "sus4", "") to its
 * canonical key, or null if unsupported.
 */
export function normalizeQuality(raw: string): string | null {
  let q = raw.replace(/\s+/g, "");
  if (q === "") return "maj";

  q = q
    .replace(/Δ/g, "maj7")
    .replace(/°/g, "dim")
    .replace(/ø/g, "m7b5")
    .replace(/\+/g, "aug");

  if (q in EXACT) return EXACT[q];
  const lower = q.toLowerCase();
  if (lower in LOWER) return LOWER[lower];
  return null;
}

export interface PianoChord {
  rootPc: number;
  /** Absolute pitch classes (0-11) present in the chord, root first. */
  notes: number[];
  bassPc: number | null;
  canonical: string;
}

/** Compute the piano pitch-class set for a chord symbol, or null if unknown. */
export function getPianoNotes(symbol: string): PianoChord | null {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;

  const canonical = normalizeQuality(parsed.quality);
  if (!canonical) return null;

  const intervals = CANONICAL_INTERVALS[canonical];
  if (!intervals) return null;

  const notes = intervals.map((i) => (parsed.rootPc + i) % 12);
  return { rootPc: parsed.rootPc, notes, bassPc: parsed.bassPc, canonical };
}
