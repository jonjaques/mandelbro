type GtagCommand = "config" | "event" | "set" | "js";

declare global {
  interface Window {
    gtag?: (command: GtagCommand, ...args: unknown[]) => void;
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (import.meta.env.DEV) return;
  window.gtag?.("event", name, params);
}
