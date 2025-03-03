import { useEffect } from "react";
import useWindowSize from "../hooks/useWindowSize.ts";
import useRendererStore from "../stores/renderer.ts";
import useCanvas from "../hooks/useCanvas.ts";
import { renderNoise } from "../lib/render.ts";

export default function Renderer() {
  const [width, height] = useWindowSize();
  const [canvasRef, setTracer] = useCanvas();
  const rendering = useRendererStore((state) => state.rendering);

  const draw = setTracer(renderNoise);

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
