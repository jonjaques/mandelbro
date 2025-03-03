import useWindowSize from "../hooks/useWindowSize.ts";
import useRendererStore from "../stores/renderer.ts";

export default function Renderer() {
  const size = useWindowSize();
  // const renderer = useRendererStore(state => state);

  return (
    <div id="renderer">
      <canvas width={size.width} height={size.height}></canvas>
    </div>
  );
}
