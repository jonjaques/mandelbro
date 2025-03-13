import { useEffect } from "react";
import useWindowSize from "../hooks/useWindowSize.ts";
import useRendererStore from "../stores/renderer.ts";
import useCanvas from "../hooks/useCanvas.ts";
import { renderNoise, renderNaiveMandelbrot } from "../lib/render.ts";

export default function Renderer() {
  const [width, height] = useWindowSize();
  const [canvasRef, setTracer] = useCanvas();
  const algorithm = useRendererStore((state) => state.algorithm);
  const rendering = useRendererStore((state) => state.rendering);

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
      <canvas ref={canvasRef} width={width} height={height}></canvas>
    </div>
  );
}
