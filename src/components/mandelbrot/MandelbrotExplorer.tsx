/**
 * MandelbrotExplorer — the root orchestrator component.
 *
 * This component is the "brain" of the app. It doesn't render any fractal
 * math itself; instead it wires together:
 *
 * - **MandelbrotCanvas** — the full-viewport <canvas> element
 * - **useMandelbrotWorker** — standard double-precision worker pool (zoom ≥ 1e-13)
 * - **usePerturbationRenderer** — arbitrary-precision perturbation pipeline (zoom < 1e-13)
 * - **useInteraction** — mouse/touch handlers for pan, zoom, and pinch
 * - **useUrlState** — two-way sync between ViewState and the URL hash
 * - **Toolbar, SettingsPanel, Coordinates, DeepZoomBanner, RenderProgress** — UI overlays
 *
 * ## Dual Rendering Pipeline
 *
 * The explorer maintains both rendering pipelines simultaneously and switches
 * between them based on zoom depth (PRECISION_THRESHOLD = 1e-13). Both produce
 * identical ChunkResult messages, so all UI overlays work transparently.
 *
 * ## State Architecture
 *
 * The canonical view state lives in `viewRef` (a ref, not React state) so it
 * can be read synchronously by event handlers without stale-closure issues.
 * A parallel `viewForUI` state drives React re-renders for the UI overlays
 * (coordinates display, settings panel). Both are always kept in sync.
 * ViewState includes optional high-precision string fields (centerXHp/centerYHp)
 * for arbitrary-precision coordinates at deep zoom.
 *
 * ## Interaction Preview Strategy
 *
 * During interaction, the explorer reuses the current canvas pixels for
 * instant visual feedback (pixel-shift for pan, snapshot transforms for zoom).
 * Once the user pauses, it dispatches a full-resolution render to reconcile
 * the exact fractal state — routing to the appropriate pipeline.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PRECISION_THRESHOLD, type ViewState } from "@/lib/mandelbrot/types";
import {
  DEFAULT_VIEW,
  flushHashState,
  stripHpFieldsWhenShallow,
} from "@/lib/mandelbrot/url-state";
import {
  viewStateToFavorite,
  favoriteToViewState,
  type Favorite,
} from "@/lib/mandelbrot/favorites";
import { useMandelbrotWorker } from "@/hooks/use-mandelbrot-worker";
import { usePerturbationRenderer } from "@/hooks/use-perturbation-renderer";
import { useUrlState } from "@/hooks/use-url-state";
import { useInteraction } from "@/hooks/use-interaction";
import { useViewportHeight } from "@/hooks/use-viewport-height";
import { useFavorites } from "@/hooks/use-favorites";
import { MandelbrotCanvas } from "./MandelbrotCanvas";
import { BrandMark } from "./BrandMark";
import { Toolbar } from "./Toolbar";
import { SettingsPanel } from "./SettingsPanel";
import { SaveFavoriteDialog } from "./SaveFavoriteDialog";
import { ReferenceDialog } from "./ReferenceDialog";
import { Coordinates } from "./Coordinates";
import { DeepZoomBanner } from "./DeepZoomBanner";
import { RenderProgress } from "./RenderProgress";

export function MandelbrotExplorer() {
  useViewportHeight();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Authoritative view state — ref (not state) for synchronous access
  // in high-frequency event handlers that would have stale closure issues
  // with React state.
  const viewRef = useRef(DEFAULT_VIEW);
  // Canvas dimensions in device pixels (set by ResizeObserver in MandelbrotCanvas)
  const sizeRef = useRef({ width: 0, height: 0 });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveFavoriteOpen, setSaveFavoriteOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  // Mirror of viewRef as React state, driving UI re-renders
  const [viewForUI, setViewForUI] = useState(DEFAULT_VIEW);

  const {
    presets,
    userFavorites,
    addFavorite,
    removeFavorite,
    renameFavorite,
  } = useFavorites();

  const {
    render: stdRender,
    cancelRender: stdCancel,
    progress: stdProgress,
  } = useMandelbrotWorker(canvasRef);
  const {
    render: pertRender,
    cancelRender: pertCancel,
    progress: pertProgress,
  } = usePerturbationRenderer(canvasRef);

  const [activeRenderer, setActiveRenderer] = useState<
    "standard" | "perturbation"
  >("standard");

  const progress =
    activeRenderer === "perturbation" ? pertProgress : stdProgress;

  const triggerRender = useCallback(
    (view: ViewState) => {
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) return;

      const usePerturb = view.zoom < PRECISION_THRESHOLD;
      setActiveRenderer(usePerturb ? "perturbation" : "standard");

      if (usePerturb) {
        stdCancel();
        pertRender(view, width, height);
      } else {
        pertCancel();
        stdRender(view, width, height);
      }
    },
    [stdRender, stdCancel, pertRender, pertCancel],
  );

  const cancelRender = useCallback(() => {
    stdCancel();
    pertCancel();
  }, [stdCancel, pertCancel]);

  // Called when the URL hash changes (e.g., browser back/forward button)
  const handleHashChange = useCallback(
    (view: ViewState) => {
      const normalized = stripHpFieldsWhenShallow(view);
      viewRef.current = normalized;
      setViewForUI(normalized);
      triggerRender(normalized); // Full quality for navigation events
    },
    [triggerRender],
  );

  const { getInitialView, syncToUrl } = useUrlState(handleHashChange);

  // Initialize view from URL hash on first mount (runs once)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initial = stripHpFieldsWhenShallow(getInitialView());
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
      const normalized = stripHpFieldsWhenShallow(view);
      viewRef.current = normalized;
      setViewForUI(normalized);
      // Debounce URL during preview-only updates; flush immediately on commit so
      // the hash matches the rendered view (and copy/paste stays faithful).
      if (commitRender) {
        flushHashState(normalized);
      } else {
        syncToUrl(normalized);
      }
      if (commitRender) {
        triggerRender(normalized);
      }
    },
    [syncToUrl, triggerRender],
  );

  // Synchronous getter for the current view — used by interaction handlers
  const getView = useCallback(() => viewRef.current, []);

  /** Full URL for sharing: always reflects `viewRef` and updates the hash first. */
  const getShareUrl = useCallback(() => {
    const v = stripHpFieldsWhenShallow(viewRef.current);
    flushHashState(v);
    return window.location.href;
  }, []);

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
          onReferenceOpen={() => {
            setReferenceOpen(true);
          }}
          getShareUrl={getShareUrl}
        />
        <SettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          getShareUrl={getShareUrl}
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
        <ReferenceDialog open={referenceOpen} onOpenChange={setReferenceOpen} />
        <Coordinates view={viewForUI} onRegisterActivity={onActivity} />
        <DeepZoomBanner
          active={activeRenderer === "perturbation"}
          zoom={viewForUI.zoom}
        />
        <RenderProgress progress={progress} />
      </TooltipProvider>
    </StrictMode>
  );
}
