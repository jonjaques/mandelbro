import { useShallow } from "zustand/shallow";
import useRendererStore from "../stores/renderer";

export default function Status() {
  const status = useRendererStore(
    useShallow((state) => ({
      rendering: state.rendering,
      done: state.done,
    })),
  );

  return (
    <div id="status">
      <div>Rendering: {simpleLabel(status?.rendering)}</div>
      <div>Done: {simpleLabel(status?.done)}</div>
    </div>
  );
}

function simpleLabel(opt: boolean) {
  return opt ? "true" : "false";
}
