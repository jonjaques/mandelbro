import { computeFrame } from "./compute";
import { mapToColors } from "./colors";
import type { RenderRequest, RenderResult } from "./types";

let currentRequestId = -1;

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const req = e.data;
  currentRequestId = req.requestId;

  const iterations = computeFrame(
    req.width,
    req.height,
    req.centerX,
    req.centerY,
    req.zoom,
    req.maxIter,
  );

  // Discard if a newer request arrived while computing
  if (currentRequestId !== req.requestId) return;

  const rgba = mapToColors(iterations, req.maxIter, req.colorScheme);

  const result: RenderResult = {
    requestId: req.requestId,
    width: req.width,
    height: req.height,
    buffer: rgba.buffer,
  };

  self.postMessage(result, [rgba.buffer] as unknown as Transferable[]);
};
