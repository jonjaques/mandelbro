/**
 * Web Worker for Mandelbrot set computation.
 *
 * This runs in a separate thread, off the main UI thread. It receives
 * RenderRequest messages and streams back ChunkResult messages (one per
 * horizontal band), followed by a RenderComplete message.
 *
 * ## Band-based streaming
 *
 * Instead of computing the entire image and sending it back in one shot,
 * the canvas is divided into 32px-tall horizontal bands. Each band is
 * computed, colored, and posted back independently. This gives us:
 *
 * 1. **Progressive display** — the user sees the image filling in band by
 *    band rather than waiting for the whole thing.
 *
 * 2. **Interruptible rendering** — between bands, we check if a new request
 *    has arrived (via `currentRequestId`). If so, we silently abandon the
 *    old render. This is what makes the "cancel stale renders" mechanism work.
 *
 * 3. **Zero-copy transfer** — each band's RGBA buffer is transferred (not
 *    copied) to the main thread via `postMessage(chunk, [buffer])`. The
 *    Transferable API moves ownership of the ArrayBuffer, so there's no
 *    serialization cost and no GC pressure.
 *
 * ## Multi-worker round-robin
 *
 * When multiple workers are in the pool, each worker processes every Nth band
 * (where N = workerCount). Worker 0 does bands 0, N, 2N, ...; worker 1 does
 * bands 1, N+1, 2N+1, ...; etc. This interleaving distributes work evenly
 * and ensures all regions of the image progress simultaneously.
 */
import { computeBand, computeBandPrecise } from "./compute";
import { mapToColors } from "./colors";
import type { RenderRequest, ChunkResult, RenderComplete } from "./types";

interface WorkerContext {
  onmessage: ((e: MessageEvent<RenderRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

const workerSelf = self as unknown as WorkerContext;

/**
 * The ID of the most recently received request. Used for cancellation:
 * if a new request arrives while we're mid-render, currentRequestId will
 * change, and the in-progress render's nextBand() will see the mismatch
 * and bail out.
 */
let currentRequestId = -1;

/**
 * Height of each horizontal band in pixels. 32px is a sweet spot:
 * - Small enough for fine-grained cancellation and smooth progressive display
 * - Large enough to amortize the per-band overhead (postMessage, setTimeout)
 * - Matches common CPU cache line patterns for memory access efficiency
 */
const BAND_HEIGHT = 32;
const PRECISE_BAND_HEIGHT = 4;

workerSelf.onmessage = (e: MessageEvent<RenderRequest>) => {
  const req = e.data;
  currentRequestId = req.requestId;
  processRequest(req);
};

function processRequest(req: RenderRequest) {
  const { width, height, maxIter, colorScheme } = req;

  // Multi-worker round-robin: this worker starts at its assigned band and
  // skips ahead by workerCount bands each iteration.
  // With 4 workers: worker 0 → bands 0,4,8,...  worker 1 → bands 1,5,9,...
  const workerIndex = req.workerIndex ?? 0;
  const workerCount = req.workerCount ?? 1;
  const bandSize = req.mode === "precise" ? PRECISE_BAND_HEIGHT : BAND_HEIGHT;
  let y = workerIndex * bandSize;
  const stride = workerCount * bandSize;

  function nextBand() {
    // ── Cancellation check ──────────────────────────────────────
    // If a newer request has come in, this render is stale — abandon it.
    // The main thread will have already incremented requestIdRef, so
    // even if we posted more chunks they'd be dropped on arrival.
    if (currentRequestId !== req.requestId) return;

    if (y >= height) {
      // All bands for this worker are done — notify the main thread.
      const complete: RenderComplete = {
        type: "complete",
        requestId: req.requestId,
      };
      workerSelf.postMessage(complete);
      return;
    }

    // Last band may be shorter than the configured band size if height isn't evenly divisible
    const bandHeight = Math.min(bandSize, height - y);

    // Step 1: Compute smooth iteration counts for every pixel in this band.
    // Returns Float64Array because the smooth coloring produces fractional values.
    const iterations =
      req.mode === "precise"
        ? computeBandPrecise(
            width,
            height,
            y,
            bandHeight,
            req.centerX,
            req.centerY,
            req.zoom,
            maxIter,
            req.precision,
          )
        : computeBand(
            width,
            height,
            y,
            bandHeight,
            req.centerX,
            req.centerY,
            req.zoom,
            maxIter,
          );

    // Step 2: Map iteration counts → RGBA pixel data using the selected palette.
    const rgba = mapToColors(iterations, maxIter, colorScheme);

    // Step 3: Transfer the RGBA buffer to the main thread.
    // The second argument `[buffer]` is the Transferable list — this moves
    // ownership of the ArrayBuffer to the main thread with zero-copy semantics.
    // After this call, `rgba.buffer` is "detached" and can no longer be used
    // in this worker (not that we need it).
    const buffer = rgba.buffer as ArrayBuffer;

    const chunk: ChunkResult = {
      type: "chunk",
      requestId: req.requestId,
      width,
      y, // absolute y position in the full canvas
      height: bandHeight,
      buffer,
    };

    workerSelf.postMessage(chunk, [buffer]);

    // Advance to this worker's next band
    y += stride;

    // ── Yield to the event loop ─────────────────────────────────
    // setTimeout(fn, 0) lets the browser process any pending messages
    // (including a new RenderRequest that would update currentRequestId).
    // Without this yield, the entire render would be synchronous and
    // un-cancellable — we'd never check for new requests.
    setTimeout(nextBand, 0);
  }

  nextBand();
}
