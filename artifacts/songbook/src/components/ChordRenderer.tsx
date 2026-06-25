import { useMemo } from "react";
import { transposeLyricsChords } from "@/lib/chords";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Segment {
  chord: string | null; // chord name, or null for plain lyric text
  lyric: string;        // lyric text that follows the chord (or stands alone)
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

// Splits a line into segments.
// "[Am]Heart beats [E]fast"
//   → [{ chord:"Am", lyric:"Heart beats " }, { chord:"E", lyric:"fast" }]
// "Colors and pro[F#m]mises"
//   → [{ chord:null, lyric:"Colors and pro" }, { chord:"F#m", lyric:"mises" }]
function parseLine(line: string): Segment[] {
  // Only treat as chord if it starts with A-G (avoids matching [Verse 1] etc.)
  const parts = line.split(/\[([A-G][^\]]*)\]/);
  // parts = [text, chord, text, chord, text, ...]
  const segments: Segment[] = [];

  // Leading lyric before the first chord
  if (parts[0]) segments.push({ chord: null, lyric: parts[0] });

  for (let i = 1; i < parts.length; i += 2) {
    segments.push({ chord: parts[i], lyric: parts[i + 1] ?? "" });
  }

  // Fallback: plain line with no chords
  if (segments.length === 0) segments.push({ chord: null, lyric: line });

  return segments;
}

// Detect section headers like [Verse 1], [Chorus], [Bridge]
function parseSectionLabel(line: string): string | null {
  const trimmed = line.trim();
  const m = trimmed.match(/^\[([^\]]+)\]$/);
  if (!m) return null;
  if (/^[A-G]/.test(m[1])) return null; // chord, not a label
  return m[1];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ChordRendererProps {
  text: string;
  zoom: number;
  transpose: number;
  lyricsOnly: boolean;
  lyricsFontSize: number;
  chordsFontSize: number;
  accentColor: string;
}

export default function ChordRenderer({
  text,
  zoom,
  transpose,
  lyricsOnly,
  lyricsFontSize,
  chordsFontSize,
}: ChordRendererProps) {
  const transposedText = useMemo(
    () => transposeLyricsChords(text, transpose),
    [text, transpose],
  );

  const lines = useMemo(
    () => transposedText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n"),
    [transposedText],
  );

  const lyricsSize = lyricsFontSize * zoom;
  const chordsSize = chordsFontSize * zoom;
  // Vertical space reserved above each lyric line for the chord name
  const chordReserved = chordsSize * 1.7;

  // ---- LYRICS ONLY mode --------------------------------------------------
  if (lyricsOnly) {
    return (
      <div
        className="text-foreground"
        style={{ fontSize: lyricsSize, lineHeight: 1.75, fontFamily: "inherit" }}
      >
        {lines.map((line, i) => {
          const label = parseSectionLabel(line);
          if (label) {
            return (
              <div
                key={i}
                className="font-bold text-primary/80 mt-6 mb-1"
                style={{ fontSize: lyricsSize * 0.85 }}
              >
                {label}
              </div>
            );
          }
          const lyric = line.replace(/\[([A-G][^\]]*)\]/g, "");
          if (!lyric.trim()) return <div key={i} style={{ height: lyricsSize * 0.6 }} />;
          return (
            <div key={i} style={{ whiteSpace: "pre-wrap" }}>
              {lyric}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- CHORD + LYRIC mode ------------------------------------------------
  return (
    <div className="text-foreground" style={{ fontSize: lyricsSize, fontFamily: "inherit" }}>
      {lines.map((line, i) => {
        // Blank line — small gap
        if (!line.trim()) {
          return <div key={i} style={{ height: chordReserved * 0.5 }} />;
        }

        // Section header — e.g. [Verse 1]
        const label = parseSectionLabel(line);
        if (label) {
          return (
            <div
              key={i}
              className="font-bold text-primary/80 mt-6 mb-1"
              style={{ fontSize: lyricsSize * 0.85 }}
            >
              {label}
            </div>
          );
        }

        const segments = parseLine(line);
        const lineHasChords = segments.some((s) => s.chord !== null);

        // Pure lyric line — render simply, no extra padding
        if (!lineHasChords) {
          return (
            <div
              key={i}
              style={{
                whiteSpace: "pre",
                lineHeight: 1.6,
                marginBottom: 2,
              }}
            >
              {segments[0]?.lyric ?? ""}
            </div>
          );
        }

        // Line with chords — each segment is an inline-block with room above for the chord
        return (
          <div key={i} style={{ lineHeight: 1, marginBottom: 6, display: "block" }}>
            {segments.map((seg, j) => (
              <span
                key={j}
                style={{
                  display: "inline-block",
                  position: "relative",
                  verticalAlign: "top",
                  // Reserve space above the lyric text for the chord name
                  paddingTop: chordReserved,
                  // Preserve whitespace so spaces act as horizontal spacers
                  whiteSpace: "pre",
                }}
              >
                {/* Chord name floating above the lyric */}
                {seg.chord && (
                  <span
                    className="text-primary font-bold select-none"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      fontSize: chordsSize,
                      lineHeight: 1,
                      // Allow chord to overflow to the right without wrapping
                      whiteSpace: "nowrap",
                    }}
                  >
                    {seg.chord}
                  </span>
                )}
                {/* Lyric text. If empty after a chord, emit a non-breaking space so the
                    inline-block has non-zero width and the chord is visible. */}
                <span style={{ whiteSpace: "pre" }}>
                  {seg.lyric !== "" ? seg.lyric : seg.chord ? "\u00a0" : ""}
                </span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
