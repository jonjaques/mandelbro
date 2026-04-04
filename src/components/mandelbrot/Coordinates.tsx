import { useCallback, useEffect, useRef, useState } from "react";
import { PRECISION_THRESHOLD, type ViewState } from "@/lib/mandelbrot/types";

interface CoordinatesProps {
  view: ViewState;
  onRegisterActivity: (cb: () => void) => void;
}

function formatNum(n: number, hp?: string): string {
  if (hp) {
    const maxLen = 24;
    return hp.length > maxLen ? hp.slice(0, maxLen) + "…" : hp;
  }
  if (Math.abs(n) < 0.0001) return n.toExponential(4);
  return n.toFixed(8);
}

function formatZoom(zoom: number): string {
  const magnification = 3.5 / zoom;
  if (magnification >= 1e6) return magnification.toExponential(2) + "x";
  if (magnification >= 1000)
    return Math.round(magnification).toLocaleString() + "x";
  return magnification.toFixed(1) + "x";
}

export function Coordinates({ view, onRegisterActivity }: CoordinatesProps) {
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    onRegisterActivity(resetHideTimer);
  }, [onRegisterActivity, resetHideTimer]);

  // Show on initial mount then start hide timer
  useEffect(() => {
    hideTimer.current = setTimeout(() => {
      setVisible(false);
    }, 3000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Show briefly when view changes
  useEffect(() => {
    const timeoutId = setTimeout(resetHideTimer, 0);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [view.centerX, view.centerY, view.zoom, resetHideTimer]);

  return (
    <div
      className="fixed z-50 glass-subtle font-mono text-xs leading-relaxed px-3 py-2 rounded-lg text-white/80 transition-opacity duration-500 select-none pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        bottom: "calc(1rem + var(--safe-area-bottom))",
        left: "calc(1rem + var(--safe-area-left))",
      }}
    >
      <div>
        Re:{" "}
        <span className="tabular-nums">
          {formatNum(view.centerX, view.centerXHp)}
        </span>
      </div>
      <div>
        Im:{" "}
        <span className="tabular-nums">
          {formatNum(view.centerY, view.centerYHp)}
        </span>
      </div>
      <div>
        Zoom: <span className="tabular-nums">{formatZoom(view.zoom)}</span>
      </div>
      {view.zoom < PRECISION_THRESHOLD && (
        <div className="text-[10px] text-amber-400/70 mt-0.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-amber-400/70" />
          Precision mode · {Math.floor(-Math.log10(view.zoom))}+ digits
        </div>
      )}
    </div>
  );
}
