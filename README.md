# Mandelbro

**The Mandelbrot set, explored without limits.**

Mandelbro is an immersive, fullscreen Mandelbrot set explorer built for the modern web. Pan, zoom, and pinch your way through infinite fractal complexity with Google Maps-level fluidity — then share any location via URL.

Powered by **perturbation theory** and **arbitrary-precision arithmetic**, Mandelbro breaks through the double-precision barrier to support deep zooms far beyond 10^14×. Explore miniature Mandelbrot copies, spiral formations, and fractal structures at magnifications of **10^50× and beyond** — all running in your browser.

**[Try it live →](https://mandelbro.app)** · [GitHub](https://github.com/jonjaques/mandelbro)

---

## Features

- **Arbitrary-precision deep zoom** — Perturbation theory with a BigFloat reference orbit enables zoom depths of 10^50+ without pixelation or precision loss
- **Instant interaction** — Canvas pixel-shifting for pan, snapshot scaling for zoom. The fractal keeps up with your hands
- **Multi-worker parallel rendering** — Web Workers stream progressive results band-by-band across CPU cores
- **Series Approximation** — Skips many early per-pixel iterations at deep zoom for large speedups on top of perturbation
- **7 color palettes** — Classic, Fire, Ocean, Grayscale, Psychedelic, Ice, Neon with smooth gradient coloring
- **Shareable deep-zoom URLs** — The view is encoded in the URL hash; deep locations use the same format as the in-app Reference / `AGENTS.md` pipeline description
- **Installable PWA** — Works offline. Install as a standalone app on any device
- **Touch-native** — Pinch-to-zoom, drag-to-pan, double-tap to zoom. Optimized for mobile and tablet
- **Auto-scaling detail** — Iteration count scales with zoom depth (capped via shared constants; see `AGENTS.md`)
- **Fullscreen immersion** — The fractal is the entire UI. Minimal glass-morphism overlays appear on demand and auto-hide

## How it works

At standard zoom levels, Mandelbro uses a multi-threaded escape-time algorithm with cardioid/bulb optimization and smooth coloring.

When you zoom past **`PRECISION_THRESHOLD`** (1e-13; defined in `src/lib/mandelbrot/types.ts`), the app switches to a **perturbation-based pipeline**:

1. **Reference orbit** — A single high-precision orbit at the view center using `bigfloat-esnext`, with Brent's cycle detection for interior points
2. **Series Approximation** — Taylor coefficients along the reference orbit to skip redundant early iterations
3. **Perturbation rendering** — A pool of Web Workers computes per-pixel deltas from the reference using native doubles
4. **Progressive display** — Bands stream to the canvas; the main thread batches paints with `requestAnimationFrame` (`use-chunk-renderer.ts`)

The transition is invisible — you keep zooming.

**Algorithms & citations** — Curated links and summaries live in `src/lib/mandelbrot/references.ts` (same content as the in-app **Reference** dialog). Use that file when you need primary sources for perturbation, SA, cycle detection, or coloring.

**Project guide for contributors and coding agents** — See **`AGENTS.md`** at the repo root for architecture, directory map, URL/hash rules, dual-pipeline behavior, quality gates (`yarn healthcheck`), and where shared constants (`constants.ts`) and worker helpers (`worker-utils.ts`) live so magic numbers are not duplicated.

## Development

```sh
yarn install
yarn dev
```

## Available Scripts

```sh
yarn dev           # Start dev server with HMR
yarn build         # Production build to /dist
yarn preview       # Preview production build locally
yarn lint          # ESLint (strict, type-aware) with zero warnings
yarn lint:fix      # Auto-fix lint issues
yarn format        # Prettier write across repo
yarn format:check  # Verify formatting only
yarn typecheck     # Astro + TypeScript project diagnostics
yarn healthcheck   # lint + format:check + typecheck + build
```

## Stack

- **Astro 5** — Zero-JS static shell with React island hydration
- **React 19** — Explorer UI with ref-first view state where it matters for input latency
- **Tailwind CSS v4** — OKLCH color theme, glass-morphism utilities
- **TypeScript** — Strict mode with defensive compiler flags
- **Web Workers** — Parallel rendering (standard + perturbation pipelines)
- **bigfloat-esnext** — Arbitrary-precision arithmetic for deep-zoom reference orbits
- **shadcn/ui** — Accessible UI components (Sheet, Slider, Tooltip)

## Repository layout (high level)

```
src/
├── pages/index.astro                 # Fullscreen shell + React island
├── components/mandelbrot/            # Explorer UI (orchestrator, canvas, toolbar, …)
├── hooks/
│   ├── use-chunk-renderer.ts         # Shared chunk queue + rAF painting + progress
│   ├── use-mandelbrot-worker.ts      # Standard worker pool
│   ├── use-perturbation-renderer.ts  # Reference orbit + perturbation pool
│   ├── use-interaction.ts            # Pan / zoom / pinch + commit debouncing
│   ├── use-url-state.ts              # Hash ↔ view (delegates to url-state)
│   ├── use-clipboard-feedback.ts     # Share / copy feedback
│   └── …
└── lib/mandelbrot/
    ├── constants.ts                  # BAILOUT, DEFAULT_ZOOM, band height, iteration caps, …
    ├── worker-utils.ts               # smoothColor, getBandHeight, WorkerContext
    ├── format.ts                     # Coordinate / zoom / magnification strings for UI
    ├── canvas-preview.ts             # Touch (and snapshot) preview drawing
    ├── references.ts                 # Curated bibliography for Reference dialog + lookup
    ├── url-state.ts                  # Hash serialization, debounce, flush, shallow HP strip
    ├── types.ts                      # ViewState, PRECISION_THRESHOLD, worker message types
    ├── compute.ts                    # Standard escape-time + autoIterations
    ├── worker.ts                     # Standard render worker
    ├── perturbation.ts               # Perturbation + series approximation
    ├── perturbation-worker.ts
    ├── reference-orbit.ts
    ├── reference-orbit-worker.ts
    ├── bigfloat-utils.ts
    ├── colors.ts
    └── favorites.ts
```

For full narrative (interaction preview/commit, URL rules, deployment branches), read **`AGENTS.md`**.

## License

MIT

## Repository

- Homepage: [https://github.com/jonjaques/mandelbro](https://github.com/jonjaques/mandelbro)
- Issues: [https://github.com/jonjaques/mandelbro/issues](https://github.com/jonjaques/mandelbro/issues)
