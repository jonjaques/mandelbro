import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewState } from "@/lib/mandelbrot/types";
import {
  formatPreciseValue,
  getMagnification,
  resolvePrecisionMode,
} from "@/lib/mandelbrot/precision";

interface CoordinatesProps {
  view: ViewState;
  onRegisterActivity: (cb: () => void) => void;
}

function formatNum(value: string): string {
  return formatPreciseValue(value, 8);
}

function formatZoom(view: ViewState): string {
  const magnification = getMagnification(view);
  if (magnification >= 1e6) return magnification.toExponential(2) + "x";
  if (magnification >= 1000)
    return Math.round(magnification).toLocaleString() + "x";
  return magnification.toFixed(1) + "x";
}

export function Coordinates({ view, onRegisterActivity }: CoordinatesProps) {
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMode = resolvePrecisionMode(view);

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
  }, [
    view.centerXPrecise,
    view.centerYPrecise,
    view.zoomPrecise,
    view.precisionMode,
    resetHideTimer,
  ]);

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
        <span className="tabular-nums">{formatNum(view.centerXPrecise)}</span>
      </div>
      <div>
        Im:{" "}
        <span className="tabular-nums">{formatNum(view.centerYPrecise)}</span>
      </div>
      <div>
        Zoom: <span className="tabular-nums">{formatZoom(view)}</span>
      </div>
      <div>
        Mode:{" "}
        <span className="tabular-nums uppercase">
          {activeMode === "precise" ? "precise" : "native"}
        </span>
      </div>
    </div>
  );
}
