import useRendererStore from "../stores/renderer";

export default function Controls() {
  const render = useRendererStore((state) => state.render);
  return (
    <div id="controls">
      controls
      <button onClick={render}>Render</button>
    </div>
  );
}
