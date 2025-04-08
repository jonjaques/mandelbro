import { useState } from "react";
import ControlsForm from "./ControlsForm";

export default function Controls() {
  const [open, setOpen] = useState(false);
  return (
    <div id="controls">
      <div className="bg-zinc-900/80 p-3 rounded-l-lg backdrop-blur-sm shadow-md py-3 z-50 transition-colors duration-300">
        <ControlsForm />
      </div>
    </div>
  );
}
