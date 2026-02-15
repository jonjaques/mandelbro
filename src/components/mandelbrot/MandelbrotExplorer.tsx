/**
 * MandelbrotExplorer — the root orchestrator component.
 *
 * This component is the "brain" of the app. It doesn't render any fractal
 * math itself; instead it wires together:
 *
 * - **MandelbrotCanvas** — the full-viewport <canvas> element
 * - **useMandelbrotWorker** — the Web Worker pool that computes fractal data
 * - **useInteraction** — mouse/touch handlers for pan, zoom, and pinch
 * - **useUrlState** — two-way sync between ViewState and the URL hash
 * - **Toolbar, SettingsPanel, Coordinates, RenderProgress** — UI overlays
 *
 * ## State Architecture
 *
 * The canonical view state lives in `viewRef` (a ref, not React state) so it
 * can be read synchronously by event handlers without stale-closure issues.
 * A parallel `viewForUI` state drives React re-renders for the UI overlays
 * (coordinates display, settings panel). Both are always kept in sync.
 *
 * ## Render Quality Tiers
 *
 * `DRAFT_SCALE = 0.5` means draft renders compute at 50% resolution in each
 * dimension (= 25% of the pixels). The worker output is then upscaled to fill
 * the canvas using bilinear interpolation. Full renders compute at native
 * canvas resolution (1:1 pixel mapping).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ViewState } from "@/lib/mandelbrot/types";
import { DEFAULT_VIEW } from "@/lib/mandelbrot/url-state";
import { useMandelbrotWorker } from "@/hooks/use-mandelbrot-worker";
import { useUrlState } from "@/hooks/use-url-state";
import { useInteraction } from "@/hooks/use-interaction";
import { MandelbrotCanvas } from "./MandelbrotCanvas";
import { Toolbar } from "./Toolbar";
import { SettingsPanel } from "./SettingsPanel";
import { Coordinates } from "./Coordinates";
import { RenderProgress } from "./RenderProgress";

/**
 * Draft renders use half resolution per axis (0.5 × 0.5 = 25% pixel count).
 * This makes draft renders ~4x faster than full renders, providing snappy
 * visual feedback during continuous interaction (wheel zoom, pinch).
 */
const DRAFT_SCALE = 0.5;

export function MandelbrotExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Authoritative view state — ref (not state) for synchronous access
  // in high-frequency event handlers that would have stale closure issues
  // with React state.
  const viewRef = useRef<ViewState>(DEFAULT_VIEW);
  // Canvas dimensions in device pixels (set by ResizeObserver in MandelbrotCanvas)
  const sizeRef = useRef({ width: 0, height: 0 });

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Mirror of viewRef as React state, driving UI re-renders
  const [viewForUI, setViewForUI] = useState<ViewState>(DEFAULT_VIEW);

  const { render, progress } = useMandelbrotWorker(canvasRef);

  /**
   * Dispatch a render to the worker pool at draft or full quality.
   * Draft renders shrink the pixel dimensions by DRAFT_SCALE before sending
   * to workers; the worker output is upscaled during painting.
   */
  const triggerRender = useCallback(
    (view: ViewState, isDraft: boolean) => {
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) return;

      const scale = isDraft ? DRAFT_SCALE : 1;
      render(view, Math.round(width * scale), Math.round(height * scale));
    },
    [render],
  );

  // Called when the URL hash changes (e.g., browser back/forward button)
  const handleHashChange = useCallback(
    (view: ViewState) => {
      viewRef.current = view;
      setViewForUI(view);
      triggerRender(view, false); // Full quality for navigation events
    },
    [triggerRender],
  );

  const { getInitialView, syncToUrl } = useUrlState(handleHashChange);

  // Initialize view from URL hash on first mount (runs once)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initial = getInitialView();
    viewRef.current = initial;
    if (initial !== DEFAULT_VIEW) {
      // Defer to avoid React batching issues with state set during mount
      setTimeout(() => {
        setViewForUI(initial);
      }, 0);
    }
  }, [getInitialView]);

  /**
   * Central handler for all view changes (from interaction, settings, or URL).
   *
   * @param isDraft - `true` for draft render, `false` for full, `"skip"` to
   *   skip rendering entirely (used during pan where pixel-shifting provides
   *   the visual feedback).
   */
  const handleViewChange = useCallback(
    (view: ViewState, isDraft: boolean | "skip") => {
      viewRef.current = view;
      setViewForUI(view);
      syncToUrl(view);
      if (isDraft !== "skip") {
        triggerRender(view, isDraft);
      }
    },
    [syncToUrl, triggerRender],
  );

  // Synchronous getter for the current view — used by interaction handlers
  const getView = useCallback(() => viewRef.current, []);

  const { onActivity } = useInteraction(canvasRef, {
    onViewChange: handleViewChange,
    getView,
  });

  // Called by MandelbrotCanvas when the viewport resizes (window resize, DPR change)
  const handleResize = useCallback(
    (width: number, height: number) => {
      sizeRef.current = { width, height };
      triggerRender(viewRef.current, false);
    },
    [triggerRender],
  );

  const handleReset = useCallback(() => {
    handleViewChange(DEFAULT_VIEW, false);
  }, [handleViewChange]);

  const handleSettingsChange = useCallback(
    (view: ViewState) => {
      handleViewChange(view, false); // Settings changes always get full render
    },
    [handleViewChange],
  );

  return (
    <TooltipProvider>
      <MandelbrotCanvas ref={canvasRef} onResize={handleResize} />
      <Toolbar
        onSettingsToggle={() => {
          setSettingsOpen((o) => !o);
        }}
        onReset={handleReset}
        colorScheme={viewForUI.colorScheme}
      />
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        view={viewForUI}
        onViewChange={handleSettingsChange}
        onReset={handleReset}
      />
      <Coordinates view={viewForUI} onRegisterActivity={onActivity} />
      <RenderProgress progress={progress} />
    </TooltipProvider>
  );
}
