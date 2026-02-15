interface RenderProgressProps {
  progress: number | null;
}

const SIZE = 48;
const STROKE_WIDTH = 3;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RenderProgress({ progress }: RenderProgressProps) {
  const visible = progress !== null;
  const pct = progress ?? 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 pointer-events-none select-none transition-opacity duration-150"
      style={{
        opacity: visible ? 1 : 0,
        transitionDelay: visible ? "300ms" : "0ms",
      }}
    >
      <div className="flex items-center justify-center rounded-full glass-subtle"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          className="absolute"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={STROKE_WIDTH}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-150 ease-linear"
          />
        </svg>
        <span className="text-[10px] font-mono text-white/80 tabular-nums">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
