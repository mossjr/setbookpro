interface Props {
  /** Absolute pitch classes (0-11) to highlight. */
  notes: number[];
  /** Root pitch class — marked with a dot. */
  rootPc: number;
  /** Optional slash bass pitch class, also highlighted. */
  bassPc?: number | null;
  /** Pixel width of the keyboard. */
  width?: number;
}

// White keys across one octave (C D E F G A B).
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];

// Black keys and the white-key index they sit immediately after.
const BLACK_KEYS = [
  { pc: 1, after: 0 }, // C#
  { pc: 3, after: 1 }, // D#
  { pc: 6, after: 3 }, // F#
  { pc: 8, after: 4 }, // G#
  { pc: 10, after: 5 }, // A#
];

export default function PianoChordDiagram({
  notes,
  rootPc,
  bassPc,
  width = 84,
}: Props) {
  const active = new Set(notes);
  if (bassPc != null) active.add(bassPc);

  const whiteW = width / 7;
  const whiteH = whiteW * 2.7;
  const blackW = whiteW * 0.62;
  const blackH = whiteH * 0.62;

  const accent = "hsl(var(--primary))";
  const rootDot = "hsl(var(--primary-foreground))";

  return (
    <svg
      width={width}
      height={whiteH}
      viewBox={`0 0 ${width} ${whiteH}`}
      role="img"
      aria-hidden
      style={{ display: "block" }}
    >
      {/* White keys */}
      {WHITE_PCS.map((pc, i) => (
        <rect
          key={`w${i}`}
          x={i * whiteW}
          y={0}
          width={whiteW}
          height={whiteH}
          rx={2}
          fill={active.has(pc) ? accent : "#ffffff"}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
      ))}

      {/* Root dot on a white root */}
      {WHITE_PCS.includes(rootPc) &&
        (() => {
          const i = WHITE_PCS.indexOf(rootPc);
          return (
            <circle
              cx={i * whiteW + whiteW / 2}
              cy={whiteH - whiteW * 0.55}
              r={whiteW * 0.2}
              fill={rootDot}
            />
          );
        })()}

      {/* Black keys */}
      {BLACK_KEYS.map((bk) => {
        const x = (bk.after + 1) * whiteW - blackW / 2;
        return (
          <rect
            key={`b${bk.pc}`}
            x={x}
            y={0}
            width={blackW}
            height={blackH}
            rx={1.5}
            fill={active.has(bk.pc) ? accent : "#222222"}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Root dot on a black root */}
      {BLACK_KEYS.some((bk) => bk.pc === rootPc) &&
        (() => {
          const bk = BLACK_KEYS.find((b) => b.pc === rootPc)!;
          const cx = (bk.after + 1) * whiteW;
          return (
            <circle
              cx={cx}
              cy={blackH - blackW * 0.7}
              r={blackW * 0.26}
              fill={rootDot}
            />
          );
        })()}
    </svg>
  );
}
