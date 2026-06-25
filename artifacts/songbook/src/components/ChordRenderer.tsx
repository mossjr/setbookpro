import { useMemo } from "react";
import { transposeLyricsChords } from "@/lib/chords";

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface Segment {
  chord: string | null;
  lyric: string;
}

// "[Am]Heart beats [E]fast"
//   → [{ chord:"Am", lyric:"Heart beats " }, { chord:"E", lyric:"fast" }]
// "Colors and pro[F#m]mises"
//   → [{ chord:null, lyric:"Colors and pro" }, { chord:"F#m", lyric:"mises" }]
function parseLine(line: string): Segment[] {
  // Only match real chords (A–G prefix). [Verse 1], [Chorus] etc. won't match.
  const parts = line.split(/\[([A-G][^\]]*)\]/);
  // parts = [text0, chord1, text1, chord2, text2, ...]
  const segments: Segment[] = [];

  if (parts[0]) segments.push({ chord: null, lyric: parts[0] });

  for (let i = 1; i < parts.length; i += 2) {
    segments.push({ chord: parts[i], lyric: parts[i + 1] ?? "" });
  }

  if (segments.length === 0) segments.push({ chord: null, lyric: line });

  return segments;
}

// Detect [Verse 1], [Chorus], etc. (not starting with A-G, so not a chord)
function parseSectionLabel(line: string): string | null {
  const m = line.trim().match(/^\[([^\]]+)\]$/);
  if (!m || /^[A-G]/.test(m[1])) return null;
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

  // ---- LYRICS ONLY mode --------------------------------------------------
  if (lyricsOnly) {
    return (
      <div className="text-foreground" style={{ fontSize: lyricsSize, lineHeight: 1.75 }}>
        {lines.map((line, i) => {
          const label = parseSectionLabel(line);
          if (label) {
            return (
              <div key={i} className="font-bold text-primary/80 mt-6 mb-1" style={{ fontSize: lyricsSize * 0.85 }}>
                {label}
              </div>
            );
          }
          const lyric = line.replace(/\[([A-G][^\]]*)\]/g, "");
          if (!lyric.trim()) return <div key={i} style={{ height: lyricsSize * 0.5 }} />;
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
    <div className="text-foreground" style={{ fontFamily: "inherit" }}>
      {lines.map((line, i) => {
        // Blank line → small gap
        if (!line.trim()) {
          return <div key={i} style={{ height: lyricsSize * 0.75 }} />;
        }

        // Section header → styled label
        const label = parseSectionLabel(line);
        if (label) {
          return (
            <div key={i} className="font-bold text-primary/80 mt-6 mb-1" style={{ fontSize: lyricsSize * 0.85 }}>
              {label}
            </div>
          );
        }

        const segments = parseLine(line);
        const lineHasChords = segments.some((s) => s.chord !== null);

        // Pure lyric line — no chord row needed at all
        if (!lineHasChords) {
          return (
            <div key={i} style={{ whiteSpace: "pre", lineHeight: 1.65, fontSize: lyricsSize, marginBottom: 2 }}>
              {segments[0]?.lyric ?? ""}
            </div>
          );
        }

        // Line with chords — use inline-flex column per segment so the
        // container is as wide as whichever of chord or lyric is wider.
        // This is critical for chord-only lines (intro riffs, etc.) where
        // the lyric slot is empty — the segment width is set by the chord.
        return (
          <div key={i} style={{ marginBottom: 4, lineHeight: 1 }}>
            {segments.map((seg, j) => {
              // Lyric text for this segment. For a chord-only segment,
              // use a non-breaking space so the segment has non-zero height
              // but the chord name itself sets the width via the flex column.
              const lyricText = seg.lyric !== "" ? seg.lyric : seg.chord ? "\u00a0" : "";

              return (
                <span
                  key={j}
                  style={{
                    display: "inline-flex",
                    flexDirection: "column",
                    verticalAlign: "bottom",
                    // Allow chord to be wider than lyric: the flex container
                    // naturally becomes max(chord width, lyric width).
                    alignItems: "flex-start",
                  }}
                >
                  {/* ── Chord row ── */}
                  <span
                    className={seg.chord ? "text-primary font-bold select-none" : ""}
                    style={{
                      fontSize: chordsSize,
                      lineHeight: 1.3,
                      // nowrap keeps long chord names (e.g. Cmaj7sus4) on one line
                      whiteSpace: "nowrap",
                      // When no chord, emit a non-breaking space to hold the row
                      // height so all lyric baselines stay on the same line.
                      paddingRight: seg.chord ? "0.4em" : 0,
                    }}
                  >
                    {seg.chord ?? "\u00a0"}
                  </span>

                  {/* ── Lyric row ── */}
                  <span
                    style={{
                      fontSize: lyricsSize,
                      lineHeight: 1.65,
                      whiteSpace: "pre",
                    }}
                  >
                    {lyricText}
                  </span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
