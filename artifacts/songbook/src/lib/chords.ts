export const CHORD_REGEX = /\[(.*?)\]/g;

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function getNoteIndex(note: string): number {
  let idx = NOTES.indexOf(note);
  if (idx === -1) {
    idx = NOTES_FLAT.indexOf(note);
  }
  return idx;
}

export function transposeChord(chord: string, steps: number): string {
  // Extract base note and modifier (e.g. "C#m7" -> "C#", "m7")
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord; // fallback
  
  const [, note, modifier] = match;
  let idx = getNoteIndex(note);
  
  if (idx === -1) return chord; // Not recognized
  
  // Transpose
  idx = (idx + steps) % 12;
  if (idx < 0) idx += 12;
  
  // Decide whether to use sharp or flat for result (simple heuristic)
  const isFlat = note.includes('b') || steps < 0; 
  const newNote = isFlat ? NOTES_FLAT[idx] : NOTES[idx];
  
  // Keep original bass note if present (e.g., C/G)
  let result = newNote + modifier;
  if (result.includes('/')) {
    const parts = result.split('/');
    if (parts.length === 2 && getNoteIndex(parts[1]) !== -1) {
      result = parts[0] + '/' + transposeChord(parts[1], steps);
    }
  }
  return result;
}

export function transposeLyricsChords(text: string, steps: number): string {
  if (steps === 0) return text;
  return text.replace(CHORD_REGEX, (match, chord) => {
    return `[${transposeChord(chord, steps)}]`;
  });
}

// ---------------------------------------------------------------------------
// Chord symbol parsing (for chord diagrams)
// ---------------------------------------------------------------------------

export interface ParsedChord {
  /** Root note as written, e.g. "C", "F#", "Bb". */
  root: string;
  /** Root pitch class, 0-11. */
  rootPc: number;
  /** Raw quality string after the root, e.g. "m7", "sus4", "" (major). */
  quality: string;
  /** Slash bass note as written (e.g. "G") or null. */
  bass: string | null;
  /** Bass pitch class 0-11, or null. */
  bassPc: number | null;
}

// A token is only a real chord if everything after the root is made up of
// chord-quality characters. This rejects bracketed section labels like
// [Bridge] or [Drum solo] whose leading letter (B, D, ...) looks like a root.
const QUALITY_SHAPE_RE =
  /^(?:maj|min|sus|add|dim|aug|m|M|°|ø|Δ|\+|-|\/|[0-9#b()\s])*$/i;

export function parseChordSymbol(symbol: string): ParsedChord | null {
  const s = symbol.trim();
  const m = s.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return null;

  const rootPc = getNoteIndex(m[1]);
  if (rootPc === -1) return null;

  let rest = m[2];
  let bass: string | null = null;
  let bassPc: number | null = null;

  const slash = rest.indexOf("/");
  if (slash >= 0) {
    const bassRaw = rest.slice(slash + 1).trim();
    const bm = bassRaw.match(/^([A-G][#b]?)/);
    const pc = bm ? getNoteIndex(bm[1]) : -1;
    if (bm && pc !== -1) {
      bass = bm[1];
      bassPc = pc;
      // Only treat the "/" as a bass separator when a real note follows.
      // Otherwise it is part of the quality (e.g. "6/9", "min/maj7").
      rest = rest.slice(0, slash);
    }
  }

  if (!QUALITY_SHAPE_RE.test(rest)) return null;

  return { root: m[1], rootPc, quality: rest.trim(), bass, bassPc };
}

/** True only for tokens that parse as a real chord (not a section label). */
export function isChordToken(token: string): boolean {
  return parseChordSymbol(token) !== null;
}

/**
 * Collect the unique chords used in a song body, in first-appearance order,
 * already transposed by `steps`. Section labels are excluded.
 */
export function extractUniqueChords(text: string, steps: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const re = /\[([A-G][^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    if (!isChordToken(raw)) continue;
    const t = transposeChord(raw, steps);
    if (!seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
}
