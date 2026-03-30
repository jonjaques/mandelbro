import { useEffect } from "react";

/**
 * Detects regular iOS Safari (not PWA standalone, not Chrome/Firefox on iOS).
 *
 * iPadOS with desktop-class Safari also reports "Macintosh" in the UA, so we
 * use `maxTouchPoints` to differentiate iPads from real Macs.
 */
function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * On iOS Safari (non-standalone), creates a barely-scrollable page so the
 * browser toolbar can collapse when the user scrolls. All app content uses
 * `position: fixed`, so scrolling is invisible to the user — the only
 * side-effect is Safari transitioning to its minimal-UI toolbar state.
 *
 * Also attempts an automatic scroll-to-1px on load, which triggers the
 * minimal toolbar in most iOS Safari versions.
 */
export function useSafariMinimalUI(): void {
  useEffect(() => {
    if (!isIOSSafari() || isStandalone()) return;

    const root = document.documentElement;

    // Override the viewport overflow so the page is scrollable.
    // Normally body's `overflow: hidden` propagates to the viewport;
    // setting overflow on <html> intercepts that propagation.
    root.style.setProperty("overflow-y", "auto", "important");
    root.style.setProperty("overflow-x", "hidden", "important");
    root.style.setProperty("overscroll-behavior-y", "none", "important");

    // Invisible spacer makes the document 1px taller than the viewport,
    // creating a minimal scrollable range.
    const spacer = document.createElement("div");
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = [
      "position: absolute",
      "top: 0",
      "left: 0",
      "width: 1px",
      "height: calc(100vh + 1px)",
      "pointer-events: none",
      "opacity: 0",
    ].join(";");
    document.body.appendChild(spacer);

    // Attempt to trigger toolbar collapse on load.
    const scrollTimer = requestAnimationFrame(() => {
      window.scrollTo({ top: 1, behavior: "smooth" });
    });

    return () => {
      cancelAnimationFrame(scrollTimer);
      root.style.removeProperty("overflow-y");
      root.style.removeProperty("overflow-x");
      root.style.removeProperty("overscroll-behavior-y");
      spacer.remove();
    };
  }, []);
}
