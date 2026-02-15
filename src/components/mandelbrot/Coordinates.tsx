import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewState } from "@/lib/mandelbrot/types";

interface CoordinatesProps {
  view: ViewState;
  onRegisterActivity: (cb: () => void) => void;
}

function formatNum(n: number): string {
  if (Math.abs(n) < 0.0001) return n.toExponential(4);
  return n.toFixed(8);
}

function formatZoom(zoom: number): string {
  const magnification = 3.5 / zoom;
  if (magnification >= 1e6) return magnification.toExponential(2) + "x";
  if (magnification >= 1000) return Math.round(magnification).toLocaleString() + "x";
  return magnification.toFixed(1) + "x";
}

export function Coordinates({ view, onRegisterActivity }: CoordinatesProps) {
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    onRegisterActivity(resetHideTimer);
  }, [onRegisterActivity, resetHideTimer]);

  // Show on initial mount then start hide timer
  useEffect(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 3000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Show briefly when view changes
  useEffect(() => {
    resetHideTimer();
  }, [view.centerX, view.centerY, view.zoom, resetHideTimer]);

  return (
    <div
      className="fixed bottom-4 left-4 z-50 glass-subtle font-mono text-xs leading-relaxed px-3 py-2 rounded-lg text-white/80 transition-opacity duration-500 select-none pointer-events-none"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div>Re: <span className="tabular-nums">{formatNum(view.centerX)}</span></div>
      <div>Im: <span className="tabular-nums">{formatNum(view.centerY)}</span></div>
      <div>Zoom: <span className="tabular-nums">{formatZoom(view.zoom)}</span></div>
    </div>
  );
}
