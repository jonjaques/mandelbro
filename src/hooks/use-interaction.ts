import { useCallback, useEffect, useRef } from "react";
import type { ViewState } from "@/lib/mandelbrot/types";
import { autoIterations } from "@/lib/mandelbrot/compute";
import { trackEvent } from "@/lib/analytics";

const DRAG_RENDER_DEBOUNCE_MS = 60;
const WHEEL_RENDER_DEBOUNCE_MS = 140;
const TOUCH_RENDER_DEBOUNCE_MS = 100;

interface InteractionCallbacks {
  /**
   * Called when the user interacts with the canvas:
   *   - `true`  → commit a full-quality render
   *   - `false` → update state but DON'T render yet because the canvas preview
   *               already provides the visual feedback
   */
  onViewChange: (view: ViewState, commitRender: boolean) => void;
  getView: () => ViewState;
  onInteractionStart: () => void;
}

interface TouchGestureState {
  mode: "pan" | "pinch";
  startView: ViewState;
  snapshot: HTMLCanvasElement;
  startTouch?: { x: number; y: number };
  startMidpoint?: { x: number; y: number };
  startDistance?: number;
}

interface WheelGestureState {
  startView: ViewState;
  snapshot: HTMLCanvasElement;
}

/**
 * Hook that attaches all user interaction handlers (pan, zoom, pinch, double-click)
 * to the canvas element.
 *
 * - During continuous interaction (drag, wheel, pinch): instant visual feedback
 *   via canvas pixel-shifting or snapshot-based previews
 * - After interaction stops (50ms debounce): schedule a full-quality render
 *
 * All coordinate math in this hook converts between three coordinate spaces:
 *
 * 1. **CSS pixels** — event.clientX/Y, element.getBoundingClientRect()
 *    The browser's layout coordinate system. Mouse/touch events report positions
 *    in this space.
 *
 * 2. **Device pixels** — canvas.width/height (CSS pixels × devicePixelRatio)
 *    The actual pixels in the canvas buffer. On a 2x Retina display, a 100px
 *    CSS-wide canvas has 200 device pixels. Canvas drawing operations (drawImage,
 *    fillRect, putImageData) work in this space.
 *
 * 3. **Complex plane** — the mathematical coordinate system of the Mandelbrot set.
 *    Defined by ViewState (centerX, centerY, zoom). The zoom value is the height
 *    of the visible region in complex-plane units; the width is zoom × aspectRatio.
 */
export function useInteraction(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  {
    onViewChange: commitViewChange,
    getView,
    onInteractionStart,
  }: InteractionCallbacks,
) {
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchGesture = useRef<TouchGestureState | null>(null);
  const wheelGesture = useRef<WheelGestureState | null>(null);
  const activityRef = useRef<(() => void) | null>(null);

  // Expose an activity callback for external use (the Coordinates HUD uses
  // this to show itself and reset its auto-hide timer on any interaction)
  const onActivity = useCallback((cb: () => void) => {
    activityRef.current = cb;
  }, []);

  /**
   * After any interaction, schedule a full-quality render after a short
   * debounce (50ms). If another interaction comes in before the timer fires,
   * the timer resets — so the full render only fires when the user pauses.
   */
  const scheduleFullRender = useCallback(
    (view: ViewState, delayMs: number, gesture: string) => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        wheelGesture.current = null;
        trackEvent(gesture, { zoom_level: view.zoom });
        commitViewChange(view, true);
      }, delayMs);
    },
    [commitViewChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── PAN (click-drag) ──────────────────────────────────────────────
    //
    // Panning uses setPointerCapture to keep receiving events even if the
    // cursor leaves the canvas (or the browser window). This prevents the
    // "stuck drag" problem.

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return; // Left button only
      onInteractionStart();
      wheelGesture.current = null;
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      activityRef.current?.();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (!isDragging.current) return;
      activityRef.current?.();

      // Delta in CSS pixels since last move event
      const dxCss = e.clientX - lastPos.current.x;
      const dyCss = e.clientY - lastPos.current.y;

      // ── Canvas pixel-shifting trick ─────────────────────────────
      //
      // Instead of re-rendering the entire fractal on every drag frame,
      // we literally shift the existing canvas pixels in the drag direction.
      // This gives INSTANT visual feedback (zero compute, zero latency).
      //
      // How it works:
      //   1. drawImage(canvas, dx, dy) — copies the canvas onto itself,
      //      offset by (dx, dy) device pixels. The browser blits the pixels
      //      in hardware.
      //   2. The shift exposes strips of "old" pixels at the edges (garbage
      //      data from the previous position). We paint these strips black.
      //
      // The full render (scheduled via debounce) will later fill in the
      // correct fractal data for the newly visible regions.
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        // Convert CSS pixels to device pixels (canvas buffer coordinates)
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const dxPx = Math.round(dxCss * dpr);
        const dyPx = Math.round(dyCss * dpr);

        // Self-blit: shift the entire canvas content by (dxPx, dyPx)
        ctx.drawImage(canvas, dxPx, dyPx);

        // Fill exposed strips with black. Which edges are exposed depends
        // on the drag direction:
        //   - Drag right (dxPx > 0): left strip exposed
        //   - Drag left  (dxPx < 0): right strip exposed
        //   - Drag down  (dyPx > 0): top strip exposed
        //   - Drag up    (dyPx < 0): bottom strip exposed
        ctx.fillStyle = "#000";
        if (dxPx > 0) ctx.fillRect(0, 0, dxPx, canvas.height);
        else if (dxPx < 0)
          ctx.fillRect(canvas.width + dxPx, 0, -dxPx, canvas.height);
        if (dyPx > 0) ctx.fillRect(0, 0, canvas.width, dyPx);
        else if (dyPx < 0)
          ctx.fillRect(0, canvas.height + dyPx, canvas.width, -dyPx);
      }

      // ── Update the mathematical view ────────────────────────────
      //
      // Convert the CSS-pixel drag distance to complex-plane distance.
      // The scale factor (zoom / rect.height) converts CSS pixels to
      // complex-plane units:
      //   - rect.height is the canvas height in CSS pixels
      //   - view.zoom is the viewport height in complex-plane units
      //   - So 1 CSS pixel = (zoom / cssHeight) complex units
      //
      // We subtract because dragging right should move the view LEFT
      // (the fractal moves with your hand, like dragging a map).
      const view = getView();
      const rect = canvas.getBoundingClientRect();
      const scale = view.zoom / rect.height;

      lastPos.current = { x: e.clientX, y: e.clientY };

      const newView: ViewState = {
        ...view,
        centerX: view.centerX - dxCss * scale,
        centerY: view.centerY - dyCss * scale,
      };

      // "skip" means: update the view state and URL, but don't trigger any
      // render — the pixel-shift already provides the visual feedback.
      // The scheduled full render will catch up when the user stops dragging.
      commitViewChange(newView, false);
      scheduleFullRender(newView, DRAG_RENDER_DEBOUNCE_MS, "pan_complete");
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      isDragging.current = false;
    };

    // ── ZOOM (mouse wheel) ────────────────────────────────────────────
    //
    // Zooms toward the cursor position, so the point under the cursor
    // stays fixed on screen. This is the "Google Maps" zoom behavior.

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      activityRef.current?.();

      const rect = canvas.getBoundingClientRect();
      const view = getView();

      if (!wheelGesture.current) {
        onInteractionStart();
        const snapshot = snapshotCanvas();
        if (!snapshot) return;
        wheelGesture.current = {
          startView: view,
          snapshot,
        };
      }

      // Mouse position as a fraction of the canvas (0 = left/top, 1 = right/bottom)
      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;

      // ── "Zoom toward cursor" math ─────────────────────────────
      //
      // Goal: after zooming, the complex-plane point under the cursor
      // should still be under the cursor.
      //
      // Step 1: Find the complex-plane coordinates under the cursor.
      //   The view center maps to screen fraction (0.5, 0.5).
      //   The cursor is at (mouseX, mouseY), offset from center by
      //   (mouseX - 0.5, mouseY - 0.5) in normalized screen coords.
      //   Scale by viewport size in complex units:
      //     worldX = centerX + (mouseX - 0.5) × zoom × aspectRatio
      //     worldY = centerY + (mouseY - 0.5) × zoom
      //
      // Step 2: Apply the zoom factor.
      //   Scroll up (deltaY < 0) → zoom in → smaller zoom value
      //   Scroll down (deltaY > 0) → zoom out → larger zoom value
      //   ±10% per wheel tick (factor = 1.1 or 1/1.1 ≈ 0.909)
      //
      // Step 3: Compute the new center so the cursor point stays fixed.
      //   Rearranging the worldX formula for centerX:
      //     newCenterX = worldX - (mouseX - 0.5) × newZoom × aspectRatio
      //   Same for Y.
      const aspectRatio = rect.width / rect.height;
      const worldX = view.centerX + (mouseX - 0.5) * view.zoom * aspectRatio;
      const worldY = view.centerY + (mouseY - 0.5) * view.zoom;

      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      const newZoom = view.zoom * factor;

      const newView: ViewState = {
        ...view,
        centerX: worldX - (mouseX - 0.5) * newZoom * aspectRatio,
        centerY: worldY - (mouseY - 0.5) * newZoom,
        zoom: newZoom,
        maxIter: autoIterations(newZoom),
      };

      commitViewChange(newView, false);
      drawViewPreview(
        wheelGesture.current.snapshot,
        wheelGesture.current.startView,
        newView,
        rect,
      );
      scheduleFullRender(newView, WHEEL_RENDER_DEBOUNCE_MS, "zoom_wheel");
    };

    // ── DOUBLE-CLICK (2x zoom in) ────────────────────────────────────
    //
    // Instantly zooms to 2x centered on the click point. Unlike wheel zoom,
    // this triggers an immediate full-quality render because it's
    // a single discrete action, not a continuous gesture.

    const handleDblClick = (e: MouseEvent) => {
      activityRef.current?.();
      const view = getView();
      const rect = canvas.getBoundingClientRect();

      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;

      const aspectRatio = rect.width / rect.height;
      const newZoom = view.zoom / 2; // 2x magnification = half the zoom range

      // New center = the complex-plane point under the cursor.
      // This is the same worldX/worldY formula from wheel zoom, but we set
      // it directly as the new center (no need to back-solve, because the
      // click point BECOMES the center).
      const newView: ViewState = {
        ...view,
        centerX: view.centerX + (mouseX - 0.5) * view.zoom * aspectRatio,
        centerY: view.centerY + (mouseY - 0.5) * view.zoom,
        zoom: newZoom,
        maxIter: autoIterations(newZoom),
      };

      trackEvent("zoom_double_click", { zoom_level: newView.zoom });
      commitViewChange(newView, true); // Full quality immediately
    };

    // ── TOUCH GESTURES (pan + pinch) ──────────────────────────────────
    //
    // Touch input uses a different preview strategy than desktop. At the start
    // of a gesture, we snapshot the currently rendered canvas into a temporary
    // buffer. Each move then re-draws that frozen snapshot with a translate /
    // scale transform. This gives smooth "native-feeling" pinch feedback using
    // already-rendered pixels, while the expensive Mandelbrot recompute waits
    // until the gesture ends.

    const clearScheduledRender = () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
      wheelGesture.current = null;
    };

    const snapshotCanvas = () => {
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      const snapshotCtx = snapshot.getContext("2d", { alpha: false });
      if (!snapshotCtx) return null;
      snapshotCtx.drawImage(canvas, 0, 0);
      return snapshot;
    };

    const drawViewPreview = (
      snapshot: HTMLCanvasElement,
      fromView: ViewState,
      toView: ViewState,
      rect: DOMRect,
    ) => {
      const ctx = canvas.getContext("2d", { alpha: false });
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
    };

    const startTouchGesture = (touches: TouchList) => {
      clearScheduledRender();
      onInteractionStart();
      const snapshot = snapshotCanvas();
      if (!snapshot) return;

      const startView = getView();

      if (touches.length === 1) {
        const touch = touches.item(0);
        if (!touch) return;
        touchGesture.current = {
          mode: "pan",
          startView,
          snapshot,
          startTouch: { x: touch.clientX, y: touch.clientY },
        };
        return;
      }

      if (touches.length === 2) {
        const touchA = touches.item(0);
        const touchB = touches.item(1);
        if (!touchA || !touchB) return;
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        touchGesture.current = {
          mode: "pinch",
          startView,
          snapshot,
          startMidpoint: {
            x: (touchA.clientX + touchB.clientX) / 2,
            y: (touchA.clientY + touchB.clientY) / 2,
          },
          startDistance: Math.max(Math.hypot(dx, dy), 1),
        };
        return;
      }

      touchGesture.current = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      activityRef.current?.();
      if (e.touches.length === 1 || e.touches.length === 2) {
        startTouchGesture(e.touches);
      } else {
        touchGesture.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const gesture = touchGesture.current;
      if (!gesture) return;

      e.preventDefault();
      activityRef.current?.();

      const rect = canvas.getBoundingClientRect();

      if (gesture.mode === "pan") {
        if (e.touches.length !== 1 || !gesture.startTouch) return;

        const touch = e.touches.item(0);
        if (!touch) return;

        const dxCss = touch.clientX - gesture.startTouch.x;
        const dyCss = touch.clientY - gesture.startTouch.y;
        const scale = gesture.startView.zoom / rect.height;
        const newView: ViewState = {
          ...gesture.startView,
          centerX: gesture.startView.centerX - dxCss * scale,
          centerY: gesture.startView.centerY - dyCss * scale,
        };
        drawViewPreview(gesture.snapshot, gesture.startView, newView, rect);
        commitViewChange(newView, false);
        return;
      }

      if (
        e.touches.length !== 2 ||
        !gesture.startMidpoint ||
        !gesture.startDistance
      ) {
        return;
      }

      const touchA = e.touches.item(0);
      const touchB = e.touches.item(1);
      if (!touchA || !touchB) return;

      const currentMidpoint = {
        x: (touchA.clientX + touchB.clientX) / 2,
        y: (touchA.clientY + touchB.clientY) / 2,
      };
      const distanceX = touchA.clientX - touchB.clientX;
      const distanceY = touchA.clientY - touchB.clientY;
      const currentDistance = Math.max(Math.hypot(distanceX, distanceY), 1);

      const aspectRatio = rect.width / rect.height;
      const startMouseX = (gesture.startMidpoint.x - rect.left) / rect.width;
      const startMouseY = (gesture.startMidpoint.y - rect.top) / rect.height;
      const currentMouseX = (currentMidpoint.x - rect.left) / rect.width;
      const currentMouseY = (currentMidpoint.y - rect.top) / rect.height;
      const worldX =
        gesture.startView.centerX +
        (startMouseX - 0.5) * gesture.startView.zoom * aspectRatio;
      const worldY =
        gesture.startView.centerY +
        (startMouseY - 0.5) * gesture.startView.zoom;
      const newZoom =
        gesture.startView.zoom * (gesture.startDistance / currentDistance);

      const newView: ViewState = {
        ...gesture.startView,
        centerX: worldX - (currentMouseX - 0.5) * newZoom * aspectRatio,
        centerY: worldY - (currentMouseY - 0.5) * newZoom,
        zoom: newZoom,
        maxIter: autoIterations(newZoom),
      };
      drawViewPreview(gesture.snapshot, gesture.startView, newView, rect);
      commitViewChange(newView, false);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1 || e.touches.length === 2) {
        startTouchGesture(e.touches);
        return;
      }

      if (!touchGesture.current) return;
      const finishedGesture = touchGesture.current;
      touchGesture.current = null;
      scheduleFullRender(
        getView(),
        finishedGesture.mode === "pinch"
          ? TOUCH_RENDER_DEBOUNCE_MS
          : DRAG_RENDER_DEBOUNCE_MS,
        finishedGesture.mode === "pinch" ? "zoom_pinch" : "pan_complete",
      );
    };

    // ── Event listener registration ───────────────────────────────────
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("dblclick", handleDblClick);
    canvas.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    canvas.addEventListener("touchmove", handleTouchMove, {
      passive: false, // Need to call preventDefault to block native zoom
    });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("dblclick", handleDblClick);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [
    canvasRef,
    commitViewChange,
    getView,
    onInteractionStart,
    scheduleFullRender,
  ]);

  return { onActivity };
}
