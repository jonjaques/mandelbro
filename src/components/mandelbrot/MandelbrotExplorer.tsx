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

const DRAFT_SCALE = 0.5;

export function MandelbrotExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<ViewState>(DEFAULT_VIEW);
  const sizeRef = useRef({ width: 0, height: 0 });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewForUI, setViewForUI] = useState<ViewState>(DEFAULT_VIEW);

  const { render, progress } = useMandelbrotWorker(canvasRef);

  const triggerRender = useCallback(
    (view: ViewState, isDraft: boolean) => {
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) return;

      const scale = isDraft ? DRAFT_SCALE : 1;
      render(
        view,
        Math.round(width * scale),
        Math.round(height * scale),
      );
    },
    [render],
  );

  const handleHashChange = useCallback(
    (view: ViewState) => {
      viewRef.current = view;
      setViewForUI(view);
      triggerRender(view, false);
    },
    [triggerRender],
  );

  const { getInitialView, syncToUrl } = useUrlState(handleHashChange);

  // Initialize view from URL on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initial = getInitialView();
    viewRef.current = initial;
    if (initial !== DEFAULT_VIEW) {
      setViewForUI(initial);
    }
  }, [getInitialView]);

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

  const getView = useCallback(() => viewRef.current, []);

  const { onActivity } = useInteraction(canvasRef, {
    onViewChange: handleViewChange,
    getView,
  });

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
      handleViewChange(view, false);
    },
    [handleViewChange],
  );

  return (
    <TooltipProvider>
      <MandelbrotCanvas
        ref={canvasRef}
        onResize={handleResize}
      />
      <Toolbar
        onSettingsToggle={() => setSettingsOpen((o) => !o)}
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
