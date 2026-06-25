import { useMemo } from "react";
import { CHORD_REGEX, transposeLyricsChords } from "@/lib/chords";

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
  text, zoom, transpose, lyricsOnly, lyricsFontSize, chordsFontSize, accentColor
}: ChordRendererProps) {
  
  const transposedText = useMemo(() => transposeLyricsChords(text, transpose), [text, transpose]);

  const lines = transposedText.split("\n");

  if (lyricsOnly) {
    return (
      <div 
        className="font-sans leading-relaxed text-foreground whitespace-pre-wrap"
        style={{ fontSize: `${lyricsFontSize * zoom}px` }}
      >
        {lines.map((line, i) => (
          <div key={i} className="min-h-[1.5em]">{line.replace(CHORD_REGEX, '')}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="font-sans leading-relaxed text-foreground w-full">
      {lines.map((line, i) => {
        // If the line is a section header like [Verse 1]
        if (line.match(/^\[(Verse|Chorus|Bridge|Intro|Outro|Solo|Pre-Chorus)/i)) {
          return (
            <div key={i} className="mt-6 mb-2 font-bold opacity-80" style={{ fontSize: `${lyricsFontSize * zoom * 1.1}px` }}>
              {line.replace(/[\[\]]/g, '')}
            </div>
          );
        }

        // We need to parse chords and lyrics interleaving
        // But Ultimate Guitar format usually has chords directly above the lyrics, OR inline [C] like we support
        // Let's render inline chords as floating badges above the text word
        
        const parts = line.split(CHORD_REGEX);
        // parts will be [lyric, chord, lyric, chord, ...]
        
        let hasChords = parts.length > 1;

        if (!hasChords && line.trim() === "") {
          return <div key={i} className="h-6" />; // Blank line
        }

        return (
          <div key={i} className={`relative flex flex-wrap items-end ${hasChords ? 'pt-8 mb-1' : 'mb-1'}`} style={{ fontSize: `${lyricsFontSize * zoom}px` }}>
            {parts.map((part, j) => {
              if (j % 2 === 1) {
                // It's a chord
                return (
                  <span key={j} className="absolute -top-7 text-primary font-bold px-1 rounded bg-primary/10 border border-primary/20 leading-none py-1" style={{ fontSize: `${chordsFontSize * zoom}px` }}>
                    {part}
                  </span>
                );
              }
              // It's a lyric
              return (
                <span key={j} className="relative inline-block whitespace-pre">
                  {part}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}