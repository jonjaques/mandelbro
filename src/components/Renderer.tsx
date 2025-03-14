import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import useWindowSize from "../hooks/useWindowSize.ts";
import useRendererStore from "../stores/renderer.ts";
import useCanvas from "../hooks/useCanvas.ts";
import { renderNoise, renderNaiveMandelbrot } from "../lib/render.ts";
import { Algorithm } from "../lib/constants.ts";

export default function Renderer() {
  const [width, height] = useWindowSize();
  const [canvasRef, setTracer] = useCanvas();
  const { cx, cy, zoom, algorithm, rendering, done, clickZoom } =
    useRendererStore(
      useShallow((state) => ({
        cx: state.cx,
        cy: state.cy,
        zoom: state.zoom,
        algorithm: state.algorithm,
        rendering: state.rendering,
        done: state.done,
        clickZoom: state.clickZoom,
      })),
    );

  const draw = setTracer((ctx, canvas) => {
    switch (algorithm) {
      case Algorithm.Naive:
        renderNaiveMandelbrot(ctx, canvas);
        break;

      case Algorithm.Noise:
      default:
        renderNoise(ctx, canvas);
        break;
    }
  });

  useEffect(() => {
    if (rendering && !done) draw();
  }, [rendering, done]);

  return (
    <div id="renderer">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={(e) => clickZoom(e, { cx, cy, zoom })}
      ></canvas>
    </div>
  );
}
