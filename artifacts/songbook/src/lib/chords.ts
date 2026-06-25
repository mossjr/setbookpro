export const CHORD_REGEX = /\[(.*?)\]/g;

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function getNoteIndex(note: string): number {
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
