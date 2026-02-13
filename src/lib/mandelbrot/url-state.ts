import type { ColorScheme, ViewState } from "./types";

export const DEFAULT_VIEW: ViewState = {
  centerX: -0.5,
  centerY: 0,
  zoom: 3.5,
  maxIter: 256,
  colorScheme: "classic",
};

const VALID_SCHEMES = new Set<ColorScheme>([
  "classic", "fire", "ocean", "grayscale", "psychedelic", "ice", "neon",
]);

export function serializeToHash(state: ViewState): string {
  const params = new URLSearchParams();
  params.set("x", state.centerX.toPrecision(15));
  params.set("y", state.centerY.toPrecision(15));
  params.set("z", state.zoom.toPrecision(10));
  params.set("i", String(state.maxIter));
  params.set("c", state.colorScheme);
  return "#" + params.toString();
}

export function deserializeFromHash(hash: string): ViewState | null {
  if (!hash || hash === "#") return null;

  const params = new URLSearchParams(hash.slice(1));
  const x = Number(params.get("x"));
  const y = Number(params.get("y"));
  const z = Number(params.get("z"));
  const i = Number(params.get("i"));
  const c = params.get("c") as ColorScheme;

  if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(i)) return null;
  if (!VALID_SCHEMES.has(c)) return null;

  return {
    centerX: x,
    centerY: y,
    zoom: z,
    maxIter: Math.max(50, Math.min(5000, Math.round(i))),
    colorScheme: c,
  };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function pushHashState(state: ViewState): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const hash = serializeToHash(state);
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }, 200);
}
