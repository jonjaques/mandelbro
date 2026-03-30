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
 * ## Interaction Preview Strategy
 *
 * During interaction, the explorer reuses the current canvas pixels for
 * instant visual feedback (pixel-shift for pan, snapshot transforms for zoom).
 * Once the user pauses, it dispatches a full-resolution render to reconcile
 * the exact fractal state.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ViewState } from "@/lib/mandelbrot/types";
import { DEFAULT_VIEW } from "@/lib/mandelbrot/url-state";
import {
  viewStateToFavorite,
  favoriteToViewState,
  type Favorite,
} from "@/lib/mandelbrot/favorites";
import { useMandelbrotWorker } from "@/hooks/use-mandelbrot-worker";
import { useUrlState } from "@/hooks/use-url-state";
import { useInteraction } from "@/hooks/use-interaction";
import { useViewportHeight } from "@/hooks/use-viewport-height";
import { useSafariMinimalUI } from "@/hooks/use-safari-minimal-ui";
import { useFavorites } from "@/hooks/use-favorites";
import { MandelbrotCanvas } from "./MandelbrotCanvas";
import { BrandMark } from "./BrandMark";
import { Toolbar } from "./Toolbar";
import { SettingsPanel } from "./SettingsPanel";
import { SaveFavoriteDialog } from "./SaveFavoriteDialog";
import { Coordinates } from "./Coordinates";
import { RenderProgress } from "./RenderProgress";

export function MandelbrotExplorer() {
  useViewportHeight();
  useSafariMinimalUI();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Authoritative view state — ref (not state) for synchronous access
  // in high-frequency event handlers that would have stale closure issues
  // with React state.
  const viewRef = useRef(DEFAULT_VIEW);
  // Canvas dimensions in device pixels (set by ResizeObserver in MandelbrotCanvas)
  const sizeRef = useRef({ width: 0, height: 0 });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveFavoriteOpen, setSaveFavoriteOpen] = useState(false);
  // Mirror of viewRef as React state, driving UI re-renders
  const [viewForUI, setViewForUI] = useState(DEFAULT_VIEW);

  const {
    presets,
    userFavorites,
    addFavorite,
    removeFavorite,
    renameFavorite,
  } = useFavorites();

  const { render, cancelRender, progress } = useMandelbrotWorker(canvasRef);

  const triggerRender = useCallback(
    (view: ViewState) => {
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) return;

      render(view, width, height);
    },
    [render],
  );

  // Called when the URL hash changes (e.g., browser back/forward button)
  const handleHashChange = useCallback(
    (view: ViewState) => {
      viewRef.current = view;
      setViewForUI(view);
      triggerRender(view); // Full quality for navigation events
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
   * @param commitRender - `true` to render immediately, `false` to rely on the
   *   interaction preview and defer rendering until the user pauses.
   */
  const handleViewChange = useCallback(
    (view: ViewState, commitRender: boolean) => {
      viewRef.current = view;
      setViewForUI(view);
      syncToUrl(view);
      if (commitRender) {
        triggerRender(view);
      }
    },
    [syncToUrl, triggerRender],
  );

  // Synchronous getter for the current view — used by interaction handlers
  const getView = useCallback(() => viewRef.current, []);

  const { onActivity } = useInteraction(canvasRef, {
    onViewChange: handleViewChange,
    getView,
    onInteractionStart: cancelRender,
  });

  // Called by MandelbrotCanvas when the viewport resizes (window resize, DPR change)
  const handleResize = useCallback(
    (width: number, height: number) => {
      sizeRef.current = { width, height };
      triggerRender(viewRef.current);
    },
    [triggerRender],
  );

  const handleReset = useCallback(() => {
    trackEvent("reset_view");
    handleViewChange(DEFAULT_VIEW, true);
  }, [handleViewChange]);

  const handleSettingsChange = useCallback(
    (view: ViewState) => {
      handleViewChange(view, true);
    },
    [handleViewChange],
  );

  const handleSaveFavorite = useCallback(
    (name: string) => {
      trackEvent("favorite_save", { name });
      addFavorite(viewStateToFavorite(viewRef.current, name));
    },
    [addFavorite],
  );

  const handleNavigateToFavorite = useCallback(
    (favorite: Favorite) => {
      trackEvent("favorite_navigate", {
        name: favorite.name,
        is_preset: favorite.isPreset,
      });
      handleViewChange(favoriteToViewState(favorite), true);
    },
    [handleViewChange],
  );

  return (
    <StrictMode>
      <TooltipProvider>
        <MandelbrotCanvas ref={canvasRef} onResize={handleResize} />
        <BrandMark canvasRef={canvasRef} />
        <Toolbar
          onSettingsToggle={() => {
            setSettingsOpen((o) => !o);
          }}
          onReset={handleReset}
          onSaveFavorite={() => {
            setSaveFavoriteOpen(true);
          }}
        />
        <SettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          view={viewForUI}
          onViewChange={handleSettingsChange}
          onReset={handleReset}
          presets={presets}
          userFavorites={userFavorites}
          onNavigateToFavorite={handleNavigateToFavorite}
          onRemoveFavorite={(id: string) => {
            trackEvent("favorite_delete");
            removeFavorite(id);
          }}
          onRenameFavorite={renameFavorite}
        />
        <SaveFavoriteDialog
          open={saveFavoriteOpen}
          onOpenChange={setSaveFavoriteOpen}
          onSave={handleSaveFavorite}
        />
        <Coordinates view={viewForUI} onRegisterActivity={onActivity} />
        <RenderProgress progress={progress} />
      </TooltipProvider>
    </StrictMode>
  );
}
