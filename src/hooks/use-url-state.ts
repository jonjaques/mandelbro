import { useCallback, useEffect } from "react";
import type { ViewState } from "@/lib/mandelbrot/types";
import {
  DEFAULT_VIEW,
  deserializeFromHash,
  pushHashState,
} from "@/lib/mandelbrot/url-state";

export function useUrlState(onHashChange: (view: ViewState) => void): {
  getInitialView: () => ViewState;
  syncToUrl: (view: ViewState) => void;
} {
  const getInitialView = useCallback((): ViewState => {
    if (typeof window === "undefined") return DEFAULT_VIEW;
    return deserializeFromHash(window.location.hash) ?? DEFAULT_VIEW;
  }, []);

  const syncToUrl = useCallback((view: ViewState) => {
    pushHashState(view);
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const parsed = deserializeFromHash(window.location.hash);
      if (parsed) onHashChange(parsed);
    };
    window.addEventListener("hashchange", handleHash);
    return () => {
      window.removeEventListener("hashchange", handleHash);
    };
  }, [onHashChange]);

  return { getInitialView, syncToUrl };
}
