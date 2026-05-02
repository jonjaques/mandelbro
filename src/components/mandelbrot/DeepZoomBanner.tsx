import { useEffect, useRef, useState } from "react";
import {
  formatMagnificationExponent,
  magnification,
} from "@/lib/mandelbrot/format";

interface DeepZoomBannerProps {
  active: boolean;
  zoom: number;
}

/**
 * Top-center banner that appears when the perturbation (arbitrary-precision)
 * pipeline activates. Shows briefly on entry and at order-of-magnitude
 * milestones, then fades out.
 */
export function DeepZoomBanner({ active, zoom }: DeepZoomBannerProps) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActiveRef = useRef(false);
  const lastMilestoneRef = useRef(0);

  useEffect(() => {
    if (!active) {
      prevActiveRef.current = false;
      lastMilestoneRef.current = 0;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
      return;
    }

    const currentExp = Math.floor(Math.log10(magnification(zoom)));

    const justEntered = !prevActiveRef.current;
    const crossedMilestone = currentExp > lastMilestoneRef.current;

    prevActiveRef.current = true;

    if (justEntered || crossedMilestone) {
      lastMilestoneRef.current = currentExp;

      if (showTimer.current) clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => {
        setVisible(true);
      }, 0);

      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
      }, 4000);
    }

    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, [active, zoom]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="fixed top-4 left-1/2 z-50 pointer-events-none select-none transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateX(-50%) translateY(${visible ? "0" : "-8px"})`,
      }}
    >
      <div className="glass-subtle rounded-full px-4 py-1.5 flex items-center gap-2 text-xs">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-white/70">
          Precision mode
          <span className="mx-1.5 text-white/30">&middot;</span>
          <span className="font-mono tabular-nums text-amber-400/80">
            {formatMagnificationExponent(zoom)}
          </span>
          <span className="mx-1.5 text-white/30">&middot;</span>
          Rendering may be slower
        </span>
      </div>
    </div>
  );
}
