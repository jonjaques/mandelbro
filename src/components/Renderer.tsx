import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import useWindowSize from "../hooks/useWindowSize.ts";
import useRendererStore from "../stores/renderer.ts";
import useCanvas from "../hooks/useCanvas.ts";
import { renderNoise, renderNaiveMandelbrot } from "../lib/render.ts";

export default function Renderer() {
  const [width, height] = useWindowSize();
  const [canvasRef, setTracer] = useCanvas();
  const algorithm = useRendererStore((state) => state.algorithm);
  const rendering = useRendererStore((state) => state.rendering);
  const clickZoom = useRendererStore((state) => state.clickZoom);
  const { cx, cy, zoom } = useRendererStore(
    useShallow((state) => ({
      cx: state.cx,
      cy: state.cy,
      zoom: state.zoom,
    })),
  );

  const draw = setTracer((ctx, canvas) => {
    switch (algorithm) {
      case "naive":
        renderNaiveMandelbrot(ctx, canvas);
        break;

      case "noise":
      default:
        renderNoise(ctx, canvas);
        break;
    }
  });

  useEffect(() => {
    if (rendering) {
      draw();
    }
  }, [rendering]);

  return (
    <div id="renderer">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={(e) => {
          clickZoom(e, { cx, cy, zoom });
          draw();
        }}
      ></canvas>
    </div>
  );
}
