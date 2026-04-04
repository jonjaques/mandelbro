# Mandelbro

**The Mandelbrot set, explored without limits.**

Mandelbro is an immersive, fullscreen Mandelbrot set explorer built for the modern web. Pan, zoom, and pinch your way through infinite fractal complexity with Google Maps-level fluidity — then share any location via URL.

Powered by **perturbation theory** and **arbitrary-precision arithmetic**, Mandelbro breaks through the double-precision barrier to support deep zooms far beyond 10^14×. Explore miniature Mandelbrot copies, spiral formations, and fractal structures at magnifications of **10^50× and beyond** — all running in your browser.

**[Try it live →](https://mandelbro.app)** · [GitHub](https://github.com/jonjaques/mandelbro)

---

## Features

- **Arbitrary-precision deep zoom** — Perturbation theory with a BigFloat reference orbit enables zoom depths of 10^50+ without pixelation or precision loss
- **Instant interaction** — Canvas pixel-shifting for pan, snapshot scaling for zoom. The fractal always keeps up with your hands
- **Multi-worker parallel rendering** — Web Workers stream progressive results band-by-band across all CPU cores
- **Series Approximation** — Skips 50–90% of per-pixel iterations at deep zoom for 2–10× speedup on top of perturbation
- **7 color palettes** — Classic, Fire, Ocean, Grayscale, Psychedelic, Ice, Neon with smooth gradient coloring
- **Shareable deep-zoom URLs** — Every view is encoded in the URL hash with full arbitrary-precision coordinates. Copy it, send it, bookmark it
- **Installable PWA** — Works offline. Install it as a standalone app on any device
- **Touch-native** — Pinch-to-zoom, drag-to-pan, double-tap to zoom. Optimized for mobile and tablet
- **Auto-scaling detail** — Iteration count automatically increases with zoom depth (up to 10,000) for maximum fractal detail
- **Fullscreen immersion** — The fractal is the entire UI. Minimal glass-morphism overlays appear on demand and auto-hide

## How It Works

At standard zoom levels, Mandelbro uses a multi-threaded escape-time algorithm with cardioid/bulb optimization and smooth coloring.

When you zoom past 10^13× magnification, the app seamlessly switches to a **perturbation-based pipeline**:

1. **Reference orbit** — A single high-precision orbit is computed at the view center using `bigfloat-esnext` arbitrary-precision arithmetic, with Brent's cycle detection for interior points
2. **Series Approximation** — Taylor series coefficients (A, B, C) are computed alongside the reference orbit to skip redundant early iterations
3. **Perturbation rendering** — A pool of Web Workers computes per-pixel deltas from the reference using fast native doubles, with SA iteration skipping
4. **Progressive display** — Bands stream back to the canvas as they complete, with rAF-batched painting

The transition is invisible to the user — you just keep zooming.

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
- **React 19** — Interactive explorer component with ref-first state model
- **Tailwind CSS v4** — OKLCH color theme, glass-morphism utilities
- **TypeScript** — Strict mode with defensive compiler flags
- **Web Workers** — Parallel multi-core rendering (standard + perturbation pipelines)
- **bigfloat-esnext** — Arbitrary-precision arithmetic for deep zoom reference orbits
- **shadcn/ui** — Accessible UI components (Sheet, Slider, Tooltip)

## Architecture

```
src/
├── pages/index.astro              # Fullscreen dark app shell
├── components/mandelbrot/         # React explorer UI
│   ├── MandelbrotExplorer.tsx     # Root orchestrator (dual pipeline switching)
│   ├── MandelbrotCanvas.tsx       # DPR-aware <canvas>
│   ├── Toolbar.tsx                # Floating glass-morphism controls
│   ├── SettingsPanel.tsx          # Settings sheet with palette/iteration controls
│   ├── Coordinates.tsx            # HUD with arbitrary-precision coordinate display
│   ├── DeepZoomBanner.tsx         # Precision mode indicator
│   └── RenderProgress.tsx         # Circular SVG progress ring
├── hooks/
│   ├── use-mandelbrot-worker.ts   # Standard double-precision worker pool
│   ├── use-perturbation-renderer.ts # Two-phase perturbation pipeline
│   ├── use-interaction.ts         # Pan/zoom/pinch with BigFloat precision
│   └── use-url-state.ts           # URL hash ↔ ViewState sync
└── lib/mandelbrot/
    ├── compute.ts                 # Standard escape-time + smooth coloring
    ├── worker.ts                  # Standard rendering worker
    ├── perturbation.ts            # Perturbation escape-time + Series Approximation
    ├── perturbation-worker.ts     # Perturbation rendering worker
    ├── reference-orbit.ts         # BigFloat reference orbit + Brent's cycle detection
    ├── reference-orbit-worker.ts  # Reference orbit Web Worker
    ├── bigfloat-utils.ts          # Precision management + BigFloat helpers
    ├── types.ts                   # ViewState, message types, PRECISION_THRESHOLD
    ├── colors.ts                  # 7 palettes + smooth color mapping
    └── url-state.ts               # URL hash serialization (arbitrary precision)
```

## License

MIT

## Repository

- Homepage: [https://github.com/jonjaques/mandelbro](https://github.com/jonjaques/mandelbro)
- Issues: [https://github.com/jonjaques/mandelbro/issues](https://github.com/jonjaques/mandelbro/issues)
