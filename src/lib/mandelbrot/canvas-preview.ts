import type { ViewState } from "@/lib/mandelbrot/types";
import { getContext2D } from "@/lib/mandelbrot/hdr";

/**
 * Copy the current canvas pixels into an offscreen buffer for gesture previews.
 */
export function snapshotCanvas(
  canvas: HTMLCanvasElement,
  wideGamut: boolean,
): HTMLCanvasElement | null {
  const snapshot = document.createElement("canvas");
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  const snapshotCtx = getContext2D(snapshot, wideGamut);
  if (!snapshotCtx) return null;
  snapshotCtx.drawImage(canvas, 0, 0);
  return snapshot;
}

/**
 * Draw a frozen snapshot scaled/translated so `fromView` → `toView` matches the
 * touch pinch/pan preview (complex-plane corners mapped to canvas pixels).
 */
export function drawViewPreview(
  canvas: HTMLCanvasElement,
  snapshot: HTMLCanvasElement,
  fromView: ViewState,
  toView: ViewState,
  rect: DOMRect,
  wideGamut: boolean,
): void {
  const ctx = getContext2D(canvas, wideGamut);
  if (!ctx) return;

  const aspectRatio = rect.width / rect.height;
  const fromWidth = fromView.zoom * aspectRatio;
  const toWidth = toView.zoom * aspectRatio;
  const fromXMin = fromView.centerX - fromWidth / 2;
  const fromYMin = fromView.centerY - fromView.zoom / 2;
  const toXMin = toView.centerX - toWidth / 2;
  const toYMin = toView.centerY - toView.zoom / 2;
  const scaleX = fromWidth / toWidth;
  const scaleY = fromView.zoom / toView.zoom;
  const translateX = ((fromXMin - toXMin) / toWidth) * canvas.width;
  const translateY = ((fromYMin - toYMin) / toView.zoom) * canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    snapshot,
    translateX,
    translateY,
    snapshot.width * scaleX,
    snapshot.height * scaleY,
  );
}
