import { useShallow } from "zustand/shallow";
import useRendererStore from "../stores/renderer";

export default function Status() {
  const status = useRendererStore(
    useShallow((state) => ({
      rendering: state.rendering,
      done: state.done,
    })),
  );

  if (status.rendering) {
    return (
      <div id="status">
        <div className="loader"></div>
      </div>
    );
  }

  return null;
}
