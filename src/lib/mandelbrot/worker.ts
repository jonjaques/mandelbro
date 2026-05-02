/**
 * Standard Web Worker for Mandelbrot set computation.
 *
 * This is the **standard pipeline** worker, used when zoom ≥ PRECISION_THRESHOLD
 * (1e-13). For deeper zooms, `perturbation-worker.ts` takes over (reference orbit
 * in arbitrary precision, per-pixel native doubles).
 *
 * @see https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation
 *
 * This runs in a separate thread, off the main UI thread. It receives
 * RenderRequest messages and streams back ChunkResult messages (one per
 * horizontal band), followed by a RenderComplete message.
 *
 * ## Band-based streaming
 *
 * Instead of computing the entire image and sending it back in one shot,
 * the canvas is divided into small horizontal bands. Each band is
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
import { computeBand, computePixelSample } from "./compute";
import { colorFromSmoothIteration, mapToColors } from "./colors";
import { getBandHeight, type WorkerContext } from "./worker-utils";
import type {
  AntialiasSamples,
  WorkerInMessage,
  RenderRequest,
  ChunkResult,
  RenderComplete,
} from "./types";

const workerSelf = self as unknown as WorkerContext<WorkerInMessage>;

/**
 * The ID of the most recently received request. Used for cancellation:
 * if a new request arrives while we're mid-render, currentRequestId will
 * change, and the in-progress render's nextBand() will see the mismatch
 * and bail out.
 */
let currentRequestId = -1;

workerSelf.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  currentRequestId = msg.requestId;

  if (msg.type === "cancel") {
    return;
  }

  processRequest(msg);
};

function processRequest(req: RenderRequest) {
  const {
    width,
    height,
    centerX,
    centerY,
    zoom,
    maxIter,
    colorScheme,
    antialiasSamples,
    wideGamut,
  } = req;

  const bandHeightStep = getBandHeight(maxIter, antialiasSamples);

  // Multi-worker round-robin: this worker starts at its assigned band and
  // skips ahead by workerCount bands each iteration.
  // With 4 workers: worker 0 → bands 0,4,8,...  worker 1 → bands 1,5,9,...
  const workerIndex = req.workerIndex ?? 0;
  const workerCount = req.workerCount ?? 1;
  let y = workerIndex * bandHeightStep;
  const stride = workerCount * bandHeightStep;

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

    // Last band may be shorter than the target band size if height isn't evenly divisible
    const bandHeight = Math.min(bandHeightStep, height - y);

    const iterData = computeBand(
      width,
      height,
      y,
      bandHeight,
      centerX,
      centerY,
      zoom,
      maxIter,
    );

    const rgba: Uint8ClampedArray =
      antialiasSamples === 1
        ? mapToColors(iterData, maxIter, colorScheme, 256, wideGamut)
        : computeSupersampledBand(
            width,
            height,
            y,
            bandHeight,
            centerX,
            centerY,
            zoom,
            maxIter,
            colorScheme,
            antialiasSamples,
            wideGamut,
          );

    const buffer = rgba.buffer as ArrayBuffer;

    const chunk: ChunkResult = {
      type: "chunk",
      requestId: req.requestId,
      width,
      y,
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

function hashFloat01(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ 61, value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  const hashed = (value ^ (value >>> 14)) >>> 0;
  return hashed / 4294967296;
}

function computeSupersampledBand(
  width: number,
  fullHeight: number,
  startY: number,
  bandHeight: number,
  centerX: number,
  centerY: number,
  zoom: number,
  maxIter: number,
  colorScheme: RenderRequest["colorScheme"],
  samples: AntialiasSamples,
  wideGamut?: boolean,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * bandHeight * 4);
  const aspectRatio = width / fullHeight;
  const halfZoom = zoom / 2;
  const xMin = centerX - halfZoom * aspectRatio;
  const yMin = centerY - halfZoom;
  const pixelWidth = (zoom * aspectRatio) / width;
  const pixelHeight = zoom / fullHeight;

  for (let localY = 0; localY < bandHeight; localY++) {
    const py = startY + localY;
    const rowOffset = localY * width;

    for (let px = 0; px < width; px++) {
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
        const baseSeed =
          Math.imul(py + 1, 374761393) ^
          Math.imul(px + 1, 668265263) ^
          Math.imul(sampleIndex + 1, 2147483647);
        const offsetX = hashFloat01(baseSeed) - 0.5;
        const offsetY = hashFloat01(baseSeed ^ 0x9e3779b9) - 0.5;
        const x0 = xMin + (px + 0.5 + offsetX) * pixelWidth;
        const y0 = yMin + (py + 0.5 + offsetY) * pixelHeight;
        const iter = computePixelSample(x0, y0, maxIter);
        const color = colorFromSmoothIteration(
          iter,
          maxIter,
          colorScheme,
          256,
          wideGamut,
        );
        red += color[0];
        green += color[1];
        blue += color[2];
      }

      const offset = (rowOffset + px) * 4;
      rgba[offset] = Math.round(red / samples);
      rgba[offset + 1] = Math.round(green / samples);
      rgba[offset + 2] = Math.round(blue / samples);
      rgba[offset + 3] = 255;
    }
  }

  return rgba;
}
