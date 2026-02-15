import { StrictMode } from "react";
import { MandelbrotExplorer } from "./MandelbrotExplorer";

export function MandelbrotExplorerEntrypoint() {
  return (
    <StrictMode>
      <MandelbrotExplorer />
    </StrictMode>
  );
}
