import type { GuitarPosition } from "@/lib/guitarChords";

interface Props {
  position: GuitarPosition;
  width?: number;
}

const STRINGS = 6;
const FRETS = 4;

export default function GuitarChordDiagram({ position, width = 84 }: Props) {
  const padX = width * 0.13;
  const padTop = width * 0.22;
  const boardW = width - padX * 2;
  const stringGap = boardW / (STRINGS - 1);
  const fretGap = stringGap * 1.18;
  const boardH = fretGap * FRETS;
  const height = padTop + boardH + width * 0.04;
  const dotR = stringGap * 0.3;
  const showNut = position.baseFret === 1;
  const showFingers = width >= 100;

  const lineColor = "hsl(var(--muted-foreground))";
  const nutColor = "hsl(var(--foreground))";
  const dotColor = "hsl(var(--primary))";
  const fingerColor = "hsl(var(--primary-foreground))";
  const markColor = "hsl(var(--muted-foreground))";

  const xFor = (s: number) => padX + s * stringGap;
  const yForFret = (f: number) => padTop + (f - 0.5) * fretGap;
  const markerY = padTop * 0.55;
  const markerFont = stringGap * 0.7;

  const barreFrets = new Set(position.barres);

  // Barre spans: for each barred fret, the min/max string holding it.
  const barres = position.barres.map((bf) => {
    const idxs: number[] = [];
    position.frets.forEach((f, s) => {
      if (f === bf) idxs.push(s);
    });
    const from = Math.min(...idxs);
    const to = Math.max(...idxs);
    return { bf, from, to };
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden
      style={{ display: "block" }}
    >
      {/* Base fret label for higher voicings */}
      {!showNut && (
        <text
          x={padX - stringGap * 0.4}
          y={yForFret(1)}
          fontSize={stringGap * 0.65}
          fill={markColor}
          textAnchor="end"
          dominantBaseline="middle"
        >
          {position.baseFret}
        </text>
      )}

      {/* Frets (horizontal) */}
      {Array.from({ length: FRETS + 1 }).map((_, i) => {
        const y = padTop + i * fretGap;
        const isNut = i === 0 && showNut;
        return (
          <line
            key={`f${i}`}
            x1={padX}
            y1={y}
            x2={padX + boardW}
            y2={y}
            stroke={isNut ? nutColor : lineColor}
            strokeWidth={isNut ? 3 : 1}
            strokeLinecap="round"
          />
        );
      })}

      {/* Strings (vertical) */}
      {Array.from({ length: STRINGS }).map((_, s) => (
        <line
          key={`s${s}`}
          x1={xFor(s)}
          y1={padTop}
          x2={xFor(s)}
          y2={padTop + boardH}
          stroke={lineColor}
          strokeWidth={1}
        />
      ))}

      {/* Open / muted markers above the nut */}
      {position.frets.map((f, s) => {
        if (f > 0) return null;
        if (f === 0) {
          return (
            <circle
              key={`o${s}`}
              cx={xFor(s)}
              cy={markerY}
              r={markerFont * 0.42}
              fill="none"
              stroke={markColor}
              strokeWidth={1}
            />
          );
        }
        return (
          <text
            key={`x${s}`}
            x={xFor(s)}
            y={markerY}
            fontSize={markerFont}
            fill={markColor}
            textAnchor="middle"
            dominantBaseline="central"
          >
            ×
          </text>
        );
      })}

      {/* Barres */}
      {barres.map(({ bf, from, to }) => (
        <rect
          key={`bar${bf}`}
          x={xFor(from) - dotR}
          y={yForFret(bf) - dotR}
          width={xFor(to) - xFor(from) + dotR * 2}
          height={dotR * 2}
          rx={dotR}
          fill={dotColor}
        />
      ))}

      {/* Finger dots (skip strings already covered by a barre) */}
      {position.frets.map((f, s) => {
        if (f <= 0 || barreFrets.has(f)) return null;
        const cx = xFor(s);
        const cy = yForFret(f);
        return (
          <g key={`d${s}`}>
            <circle cx={cx} cy={cy} r={dotR} fill={dotColor} />
            {showFingers && position.fingers[s] > 0 && (
              <text
                x={cx}
                y={cy}
                fontSize={dotR * 1.3}
                fill={fingerColor}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {position.fingers[s]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
