/**
 * BrandMark — the "mandelbro" wordmark, positioned top-left over the canvas.
 *
 * The text color adapts to the fractal content beneath it: white on dark
 * regions, black on light regions, with a contrasting text-shadow outline
 * for readability on busy backgrounds. The transition between states is
 * smoothed with a 300ms CSS transition.
 */
import type { RefObject } from "react";
import { useRef } from "react";
import { useCanvasLuminance } from "@/hooks/use-canvas-luminance";

interface BrandMarkProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function BrandMark({ canvasRef }: BrandMarkProps) {
  const brandRef = useRef<HTMLDivElement>(null);
  const isLightBg = useCanvasLuminance(canvasRef, brandRef);

  const textColor = isLightBg ? "#000" : "#fff";
  const outlineColor = isLightBg ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
  const textShadow = [
    `-1px -1px 0 ${outlineColor}`,
    `1px -1px 0 ${outlineColor}`,
    `-1px 1px 0 ${outlineColor}`,
    `1px 1px 0 ${outlineColor}`,
    `0 0 6px ${outlineColor}`,
  ].join(", ");

  return (
    <div
      ref={brandRef}
      className="fixed z-40 pointer-events-none select-none px-3 py-2"
      style={{
        top: "calc(1rem + var(--safe-area-top))",
        left: "calc(1rem + var(--safe-area-left))",
      }}
    >
      <h1
        className="text-2xl leading-none uppercase transition-[color,text-shadow] duration-300"
        style={{
          fontFamily: "'Macula', sans-serif",
          fontWeight: 500,
          color: textColor,
          textShadow,
        }}
      >
        mandelbro
      </h1>
    </div>
  );
}
