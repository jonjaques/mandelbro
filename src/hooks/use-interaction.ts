import { useCallback, useEffect, useRef } from "react";
import { PRECISION_THRESHOLD, type ViewState } from "@/lib/mandelbrot/types";
import { autoIterations } from "@/lib/mandelbrot/compute";
import { trackEvent } from "@/lib/analytics";
import {
  add as bfAdd,
  make as bfMake,
  toString as bfToString,
} from "@/lib/mandelbrot/bigfloat-utils";

const DRAG_RENDER_DEBOUNCE_MS = 60;
const WHEEL_RENDER_DEBOUNCE_MS = 140;
const TOUCH_RENDER_DEBOUNCE_MS = 100;

/**
 * Update high-precision center coordinates by adding a small double offset.
 * Automatically creates HP strings when zooming past PRECISION_THRESHOLD,
 * bootstrapping from the current double-precision values.
 */
function applyHpDelta(
  view: ViewState,
  dxComplex: number,
  dyComplex: number,
  newZoom: number,
): Pick<ViewState, "centerXHp" | "centerYHp"> {
  const needsHp =
    newZoom < PRECISION_THRESHOLD ||
    view.centerXHp != null ||
    view.centerYHp != null;
  if (!needsHp) return {};

  const baseX = view.centerXHp ?? view.centerX.toPrecision(15);
  const baseY = view.centerYHp ?? view.centerY.toPrecision(15);

  return {
    centerXHp: bfToString(bfAdd(bfMake(baseX), bfMake(dxComplex))),
    centerYHp: bfToString(bfAdd(bfMake(baseY), bfMake(dyComplex))),
  };
}

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
  cursorCanvasX: number;
  cursorCanvasY: number;
}

/**
 * Hook that attaches all user interaction handlers (pan, zoom, pinch, double-click)
 * to the canvas element.
 *
 * - During continuous interaction (drag, wheel, pinch): instant visual feedback
 *   via canvas pixel-shifting or snapshot-based previews
 * - After interaction stops (debounce varies by gesture): schedule a full-quality render
 * - At deep zoom (past PRECISION_THRESHOLD): coordinate updates use BigFloat
 *   arithmetic via applyHpDelta() to maintain arbitrary-precision center coordinates
 * - Zoom math uses algebraic deltas to avoid catastrophic cancellation at deep zoom
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
 *    At deep zoom, the Hp string fields carry full arbitrary-precision coordinates.
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
  // Tracks the last single-tap for double-tap detection. We implement our own
  // because e.preventDefault() in touchstart (required to prevent touchcancel
  // on iOS) suppresses the synthetic dblclick that browsers generate from touch.
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(
    null,
  );

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

      const dxComplex = -dxCss * scale;
      const dyComplex = -dyCss * scale;

      const newView: ViewState = {
        ...view,
        centerX: view.centerX + dxComplex,
        centerY: view.centerY + dyComplex,
        ...applyHpDelta(view, dxComplex, dyComplex, view.zoom),
      };

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

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (!wheelGesture.current) {
        onInteractionStart();
        const snapshot = snapshotCanvas();
        if (!snapshot) return;
        wheelGesture.current = {
          startView: view,
          snapshot,
          cursorCanvasX: (e.clientX - rect.left) * dpr,
          cursorCanvasY: (e.clientY - rect.top) * dpr,
        };
      }

      // Mouse position as a fraction of the canvas (0 = left/top, 1 = right/bottom)
      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;

      // ── "Zoom toward cursor" with algebraic delta ──────────────
      //
      // Instead of computing worldX = center + offset then
      // newCenter = worldX - offset' (which suffers catastrophic
      // cancellation at deep zoom), we compute the center delta
      // directly: delta = (mousePos - 0.5) * aspect * (zoom - newZoom).
      // This avoids adding a tiny correction to a large coordinate.
      const aspectRatio = rect.width / rect.height;
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      const newZoom = view.zoom * factor;

      const zoomDelta = view.zoom - newZoom;
      const dxComplex = (mouseX - 0.5) * aspectRatio * zoomDelta;
      const dyComplex = (mouseY - 0.5) * zoomDelta;

      const { zoomHp, ...viewBase } = view;
      void zoomHp;
      const newView: ViewState = {
        ...viewBase,
        centerX: view.centerX + dxComplex,
        centerY: view.centerY + dyComplex,
        zoom: newZoom,
        maxIter: autoIterations(newZoom),
        ...applyHpDelta(view, dxComplex, dyComplex, newZoom),
      };

      commitViewChange(newView, false);

      // Cursor-centered preview: scale snapshot around cursor position.
      // This avoids using double-precision center coordinates which
      // lose accuracy at deep zoom.
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        const {
          snapshot,
          cursorCanvasX: cx,
          cursorCanvasY: cy,
        } = wheelGesture.current;
        const overallScale = wheelGesture.current.startView.zoom / newView.zoom;
        ctx.imageSmoothingEnabled = true;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          snapshot,
          cx * (1 - overallScale),
          cy * (1 - overallScale),
          snapshot.width * overallScale,
          snapshot.height * overallScale,
        );
      }

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
      const newZoom = view.zoom / 2;

      const dxComplex = (mouseX - 0.5) * view.zoom * aspectRatio;
      const dyComplex = (mouseY - 0.5) * view.zoom;

      const { zoomHp, ...viewBase } = view;
      void zoomHp;
      const newView: ViewState = {
        ...viewBase,
        centerX: view.centerX + dxComplex,
        centerY: view.centerY + dyComplex,
        zoom: newZoom,
        maxIter: autoIterations(newZoom),
        ...applyHpDelta(view, dxComplex, dyComplex, newZoom),
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
        // Prevent the browser from claiming this gesture for elastic-scroll or
        // pinch-zoom. Without this, iOS fires touchcancel when it decides to
        // handle the touch itself, which clears touchGesture.current and makes
        // all subsequent touchmove events no-ops → "frozen" canvas on mobile.
        e.preventDefault();
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
        const dxComplex = -dxCss * scale;
        const dyComplex = -dyCss * scale;
        const newView: ViewState = {
          ...gesture.startView,
          centerX: gesture.startView.centerX + dxComplex,
          centerY: gesture.startView.centerY + dyComplex,
          ...applyHpDelta(
            gesture.startView,
            dxComplex,
            dyComplex,
            gesture.startView.zoom,
          ),
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
      const newZoom =
        gesture.startView.zoom * (gesture.startDistance / currentDistance);

      // Algebraic delta avoids catastrophic cancellation at deep zoom
      const dxComplex =
        (startMouseX - 0.5) * gesture.startView.zoom * aspectRatio -
        (currentMouseX - 0.5) * newZoom * aspectRatio;
      const dyComplex =
        (startMouseY - 0.5) * gesture.startView.zoom -
        (currentMouseY - 0.5) * newZoom;

      const { zoomHp, ...startBase } = gesture.startView;
      void zoomHp;
      const newView: ViewState = {
        ...startBase,
        centerX: gesture.startView.centerX + dxComplex,
        centerY: gesture.startView.centerY + dyComplex,
        zoom: newZoom,
        maxIter: autoIterations(newZoom),
        ...applyHpDelta(gesture.startView, dxComplex, dyComplex, newZoom),
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

      // ── Double-tap detection ─────────────────────────────────────────
      //
      // e.preventDefault() in touchstart prevents the browser from generating
      // synthetic dblclick events from touch. We implement double-tap ourselves:
      // two taps within 300ms within 30px of each other, with minimal movement
      // during each tap (< 15px drift means it was a tap, not a pan).
      if (finishedGesture.mode === "pan" && e.changedTouches.length === 1) {
        const touch = e.changedTouches.item(0);
        if (touch) {
          const now = Date.now();
          const last = lastTapRef.current;
          const tapDrift =
            finishedGesture.startTouch != null
              ? Math.hypot(
                  touch.clientX - finishedGesture.startTouch.x,
                  touch.clientY - finishedGesture.startTouch.y,
                )
              : Infinity;
          const isTap = tapDrift < 15;

          if (
            isTap &&
            last != null &&
            now - last.time < 300 &&
            Math.abs(touch.clientX - last.x) < 30 &&
            Math.abs(touch.clientY - last.y) < 30
          ) {
            // Double-tap: zoom in 2× toward tap position (same as dblclick)
            lastTapRef.current = null;
            if (idleTimer.current) {
              clearTimeout(idleTimer.current);
              idleTimer.current = null;
            }
            const rect = canvas.getBoundingClientRect();
            const mouseX = (touch.clientX - rect.left) / rect.width;
            const mouseY = (touch.clientY - rect.top) / rect.height;
            const view = getView();
            const aspectRatio = rect.width / rect.height;
            const newZoom = view.zoom / 2;
            const dxComplex = (mouseX - 0.5) * view.zoom * aspectRatio;
            const dyComplex = (mouseY - 0.5) * view.zoom;
            const { zoomHp, ...viewBase } = view;
            void zoomHp;
            const newView: ViewState = {
              ...viewBase,
              centerX: view.centerX + dxComplex,
              centerY: view.centerY + dyComplex,
              zoom: newZoom,
              maxIter: autoIterations(newZoom),
              ...applyHpDelta(view, dxComplex, dyComplex, newZoom),
            };
            trackEvent("zoom_double_tap", { zoom_level: newView.zoom });
            commitViewChange(newView, true);
            return;
          }

          lastTapRef.current = isTap
            ? { time: now, x: touch.clientX, y: touch.clientY }
            : null;
        }
      } else {
        // Pinch or multi-touch: reset tap state so a subsequent single tap
        // doesn't accidentally trigger double-tap zoom.
        lastTapRef.current = null;
      }

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
      passive: false, // Must be non-passive to allow e.preventDefault() which prevents touchcancel on iOS
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
