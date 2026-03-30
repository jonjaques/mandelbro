/**
 * Circular progress indicator shown in the bottom-right corner during rendering.
 *
 * Uses SVG stroke-dashoffset animation to draw a circular progress ring.
 * The "trick" is that a circle with a dashed stroke (dasharray = circumference)
 * looks like a full ring when dashoffset = 0, and invisible when dashoffset =
 * circumference. Animating between those values traces an arc.
 *
 * Appears with a 300ms delay (to avoid flashing on fast renders) and disappears
 * instantly when rendering completes.
 */
interface RenderProgressProps {
  progress: number | null;
}

const SIZE = 48;
const STROKE_WIDTH = 3;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
// Total length of the circle's circumference (used for stroke-dash animation)
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RenderProgress({ progress }: RenderProgressProps) {
  const visible = progress !== null;
  // When hiding (progress = null), hold at 100% so the bar doesn't animate
  // backward during the opacity fade-out. The 300ms appear delay ensures
  // the 100→0 reset is invisible when the next render starts.
  const pct = progress ?? 100;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <div
      className="fixed z-50 pointer-events-none select-none transition-opacity duration-150"
      style={{
        opacity: visible ? 1 : 0,
        bottom: "calc(1rem + var(--safe-area-bottom))",
        right: "calc(1rem + var(--safe-area-right))",
        transitionDelay: visible ? "300ms" : "0ms",
      }}
    >
      <div
        className="flex items-center justify-center rounded-full glass-subtle"
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
          />
        </svg>
        <span className="text-[10px] font-mono text-white/80 tabular-nums">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
