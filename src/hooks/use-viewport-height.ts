import { useEffect } from "react";

/**
 * Keeps the CSS viewport height variable aligned with the live visual viewport.
 *
 * iOS standalone PWAs can report a shorter visible height than `100vh`/`100dvh`,
 * which leaves a strip at the bottom of fixed fullscreen layouts. We expose the
 * measured height as `--app-height`, then let CSS choose the larger of that and
 * `100vh` for a full-screen "cover" height.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    const root = document.documentElement;
    let frameId = 0;

    const syncViewportHeight = () => {
      const viewport = window.visualViewport;
      const height = Math.round(viewport?.height ?? window.innerHeight);
      root.style.setProperty("--app-height", `${height}px`);
    };

    const requestSync = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncViewportHeight);
    };

    requestSync();

    window.addEventListener("resize", requestSync);
    window.addEventListener("orientationchange", requestSync);
    window.addEventListener("pageshow", requestSync);
    window.visualViewport?.addEventListener("resize", requestSync);
    window.visualViewport?.addEventListener("scroll", requestSync);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", requestSync);
      window.removeEventListener("orientationchange", requestSync);
      window.removeEventListener("pageshow", requestSync);
      window.visualViewport?.removeEventListener("resize", requestSync);
      window.visualViewport?.removeEventListener("scroll", requestSync);
    };
  }, []);
}
