import { useEffect } from "react";
import useWindowSize from "../hooks/useWindowSize.ts";
import useRendererStore from "../stores/renderer.ts";
import useCanvas from "../hooks/useCanvas.ts";

export default function Renderer() {
  const [width, height] = useWindowSize();
  const [canvasRef, setTracer] = useCanvas();
  const rendering = useRendererStore((state) => state.rendering);

  const draw = setTracer((ctx, canvas) => {
    console.log("render");
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const color = Math.floor(Math.random() * 255);
      imageData.data[i + 0] = color;
      imageData.data[i + 1] = color;
      imageData.data[i + 2] = color;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
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
