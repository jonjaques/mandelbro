import { useCallback, useRef, useState } from "react";
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

const MAX_DPR = 2;
const DRAFT_SCALE = 0.5;

export function MandelbrotExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<ViewState>(DEFAULT_VIEW);
  const sizeRef = useRef({ width: 0, height: 0 });

  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewForUI, setViewForUI] = useState<ViewState>(DEFAULT_VIEW);

  const onResult = useCallback((data: ImageData) => {
    setImageData(data);
  }, []);

  const { render } = useMandelbrotWorker(onResult);

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

  // Initialize view from URL on first render
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    const initial = getInitialView();
    viewRef.current = initial;
    // We can't call setViewForUI during render, but the default state matches DEFAULT_VIEW
    // and we'll trigger a render on first resize anyway
    if (initial !== DEFAULT_VIEW) {
      // Defer the state update
      queueMicrotask(() => setViewForUI(initial));
    }
  }

  const handleViewChange = useCallback(
    (view: ViewState, isDraft: boolean) => {
      viewRef.current = view;
      setViewForUI(view);
      syncToUrl(view);
      triggerRender(view, isDraft);
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
        imageData={imageData}
        onResize={handleResize}
      />
      <Toolbar
        onSettingsToggle={() => setSettingsOpen((o) => !o)}
        onReset={handleReset}
      />
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        view={viewForUI}
        onViewChange={handleSettingsChange}
        onReset={handleReset}
      />
      <Coordinates view={viewForUI} onRegisterActivity={onActivity} />
    </TooltipProvider>
  );
}
