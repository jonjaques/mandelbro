import { useCallback, useEffect, useRef } from "react";
import type { ViewState } from "@/lib/mandelbrot/types";
import { autoIterations } from "@/lib/mandelbrot/compute";

interface InteractionCallbacks {
  onViewChange: (view: ViewState, isDraft: boolean | "skip") => void;
  getView: () => ViewState;
}

export function useInteraction(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  { onViewChange, getView }: InteractionCallbacks,
) {
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchDistance = useRef<number | null>(null);
  const activityRef = useRef<() => void>(() => {});

  // Expose an activity callback for external use (coordinates HUD)
  const onActivity = useCallback((cb: () => void) => {
    activityRef.current = cb;
  }, []);

  const scheduleFullRender = useCallback(
    (view: ViewState) => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        onViewChange(view, false);
      }, 50);
    },
    [onViewChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      activityRef.current();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      activityRef.current();

      const dxCss = e.clientX - lastPos.current.x;
      const dyCss = e.clientY - lastPos.current.y;

      // Immediately shift canvas pixels for instant visual feedback
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const dxPx = Math.round(dxCss * dpr);
        const dyPx = Math.round(dyCss * dpr);

        ctx.drawImage(canvas, dxPx, dyPx);

        // Clear newly exposed strips with black
        ctx.fillStyle = "#000";
        if (dxPx > 0) ctx.fillRect(0, 0, dxPx, canvas.height);
        else if (dxPx < 0)
          ctx.fillRect(canvas.width + dxPx, 0, -dxPx, canvas.height);
        if (dyPx > 0) ctx.fillRect(0, 0, canvas.width, dyPx);
        else if (dyPx < 0)
          ctx.fillRect(0, canvas.height + dyPx, canvas.width, -dyPx);
      }

      const view = getView();
      const rect = canvas.getBoundingClientRect();
      const scale = view.zoom / rect.height;

      lastPos.current = { x: e.clientX, y: e.clientY };

      const newView: ViewState = {
        ...view,
        centerX: view.centerX - dxCss * scale,
        centerY: view.centerY - dyCss * scale,
      };

      // Pixel shifting already provides instant visual feedback during drag,
      // so skip draft renders — just sync state and schedule full render
      onViewChange(newView, "skip");
      scheduleFullRender(newView);
    };

    const handlePointerUp = () => {
      isDragging.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      activityRef.current();

      const view = getView();
      const rect = canvas.getBoundingClientRect();

      // Zoom toward cursor position
      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;

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

      onViewChange(newView, true);
      scheduleFullRender(newView);
    };

    const handleDblClick = (e: MouseEvent) => {
      activityRef.current();
      const view = getView();
      const rect = canvas.getBoundingClientRect();

      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;

      const aspectRatio = rect.width / rect.height;
      const newZoom = view.zoom / 2;

      const newView: ViewState = {
        ...view,
        centerX: view.centerX + (mouseX - 0.5) * view.zoom * aspectRatio,
        centerY: view.centerY + (mouseY - 0.5) * view.zoom,
        zoom: newZoom,
        maxIter: autoIterations(newZoom),
      };

      onViewChange(newView, false);
    };

    // Touch pinch-to-zoom
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDistance.current = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDistance.current !== null) {
        e.preventDefault();
        activityRef.current();

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);

        const view = getView();
        const factor = pinchDistance.current / newDist;
        const newZoom = view.zoom * factor;

        pinchDistance.current = newDist;

        const newView: ViewState = {
          ...view,
          zoom: newZoom,
          maxIter: autoIterations(newZoom),
        };
        onViewChange(newView, true);
        scheduleFullRender(newView);
      }
    };

    const handleTouchEnd = () => {
      pinchDistance.current = null;
    };

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
      passive: false,
    });
    canvas.addEventListener("touchend", handleTouchEnd);

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
    };
  }, [canvasRef, getView, onViewChange, scheduleFullRender]);

  return { onActivity };
}
