import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import useWindowSize from "../hooks/useWindowSize.ts";
import useRendererStore from "../stores/renderer.ts";
import useCanvas from "../hooks/useCanvas.ts";
import {
  renderNoise,
  renderNaiveMandelbrot,
  renderRevisedMandelbrot,
} from "../lib/render.ts";
import { Algorithm } from "../lib/constants.ts";
import FancyRenderer from "./FancyRenderer.tsx";

export default function Renderer() {
  const [canvasRef, setTracer] = useCanvas();
  const [width, height] = useWindowSize(undefined, onResize);
  const { cx, cy, zoom, algorithm, rerender, rendering, done, clickZoom } =
    useRendererStore(
      useShallow((state) => ({
        cx: state.cx,
        cy: state.cy,
        zoom: state.zoom,
        algorithm: state.algorithm,
        rendering: state.rendering,
        done: state.done,
        clickZoom: state.clickZoom,
        rerender: state.rerender,
      })),
    );

  const draw = setTracer((ctx, canvas) => {
    switch (algorithm) {
      case Algorithm.Revised:
        renderRevisedMandelbrot(ctx, canvas);
        break;
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

  if (algorithm === Algorithm.Fancy) {
    return <FancyRenderer width={width} height={height} />;
  }

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

  function onResize() {
    if (canvasRef.current) {
      rerender();
    }
  }
}
