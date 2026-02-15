/**
 * Hook for two-way sync between the ViewState and the URL hash.
 *
 * Outbound: `syncToUrl(view)` writes the current view to the URL hash
 * (debounced at 200ms via pushHashState).
 *
 * Inbound: when the URL hash changes externally (browser back/forward buttons,
 * manual URL editing), the `onHashChange` callback fires with the parsed view,
 * allowing the app to navigate to the new position.
 *
 * On mount, `getInitialView()` reads the URL hash to restore any previously
 * shared or bookmarked view. Falls back to DEFAULT_VIEW if the hash is empty
 * or invalid.
 */
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
    if (typeof window === "undefined") return DEFAULT_VIEW; // SSR guard
    return deserializeFromHash(window.location.hash) ?? DEFAULT_VIEW;
  }, []);

  const syncToUrl = useCallback((view: ViewState) => {
    pushHashState(view);
  }, []);

  // Listen for external hash changes (back/forward navigation)
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
