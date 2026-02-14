import { computeBand } from "./compute";
import { mapToColors } from "./colors";
import type { RenderRequest, ChunkResult, RenderComplete } from "./types";

let currentRequestId = -1;

const BAND_HEIGHT = 32;

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const req = e.data;
  currentRequestId = req.requestId;
  processRequest(req);
};

function processRequest(req: RenderRequest) {
  const { width, height, centerX, centerY, zoom, maxIter, colorScheme } = req;

  // Multi-worker: each worker processes every Nth band (round-robin)
  const workerIndex = req.workerIndex ?? 0;
  const workerCount = req.workerCount ?? 1;
  let y = workerIndex * BAND_HEIGHT;
  const stride = workerCount * BAND_HEIGHT;

  function nextBand() {
    if (currentRequestId !== req.requestId) return;

    if (y >= height) {
      const complete: RenderComplete = {
        type: "complete",
        requestId: req.requestId,
      };
      self.postMessage(complete);
      return;
    }

    const bandHeight = Math.min(BAND_HEIGHT, height - y);

    const iterations = computeBand(
      width,
      height,
      y,
      bandHeight,
      centerX,
      centerY,
      zoom,
      maxIter,
    );

    const rgba = mapToColors(iterations, maxIter, colorScheme);

    const chunk: ChunkResult = {
      type: "chunk",
      requestId: req.requestId,
      width,
      y,
      height: bandHeight,
      buffer: rgba.buffer,
    };

    self.postMessage(chunk, [rgba.buffer] as unknown as Transferable[]);

    y += stride;

    // Yield to event loop so incoming messages can update currentRequestId
    setTimeout(nextBand, 0);
  }

  nextBand();
}
