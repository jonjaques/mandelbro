# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Mandelbro** is a best-of-breed fullscreen Mandelbrot set explorer — an immersive, installable web app where the fractal _is_ the entire UI. The goal is Google Maps-level interaction fluidity applied to mathematical visualization: instant visual feedback during navigation, progressive high-fidelity rendering when idle, and shareable deep-zoom URLs. Every technical decision serves one UX principle: **the user should never wait for the math to catch up with their hands.**

## Build & Development Commands

```sh
yarn dev          # Start dev server with HMR
yarn build        # Production build to /dist
yarn preview      # Preview production build locally
yarn lint         # ESLint (strict, type-aware) with zero warnings allowed
yarn lint:fix     # Auto-fix lint issues when possible
yarn format       # Prettier write across repo
yarn format:check # Verify formatting only
yarn typecheck    # Astro + TypeScript project diagnostics
yarn healthcheck  # lint + format:check + typecheck + build
```

No test framework is currently configured.

## Architecture

**Astro 5 + React 19** hybrid static site using **Tailwind CSS v4** and **shadcn/ui** components (new-york style). Astro provides the zero-JS static shell; a single React island (`client:load`) runs the entire explorer.

### Dual Component Model

- **Astro components** (`.astro`) — server-rendered, zero JS by default. Used for pages and layouts.
- **React components** (`.tsx`) — client-side interactive islands, hydrated with `client:load` directive.

### Directory Layout

- `src/pages/` — File-based routing (Astro pages); `index.astro` is the fullscreen dark app shell
- `src/layouts/` — Page layout templates
- `src/components/mandelbrot/` — React components for the explorer UI
  - `MandelbrotExplorer.tsx` — Root orchestrator: wires together state, workers, interaction, URL sync, UI overlays, and the `StrictMode` wrapper
  - `MandelbrotCanvas.tsx` — Full-viewport `<canvas>` with ResizeObserver, DPR-aware (capped at 2x)
  - `Toolbar.tsx` — Floating glass-morphism buttons: settings, share URL, reset view, fullscreen toggle; brand mark with palette-adaptive gradient + glow
  - `SettingsPanel.tsx` — shadcn Sheet with iterations slider, color scheme selector, coordinate display with copy-to-clipboard, share URL, and reset
  - `Coordinates.tsx` — Bottom-left HUD showing Re/Im/zoom, auto-hides after 3s of inactivity, reappears on interaction or view change
  - `RenderProgress.tsx` — Bottom-right circular SVG progress indicator (stroke-dashoffset animation), appears with 300ms delay during renders
- `src/components/ui/` — shadcn/ui React components (generated via `yarn dlx shadcn` or `yarn shadcn` CLI)
- `src/hooks/` — React hooks (the core interaction and rendering logic lives here)
  - `use-mandelbrot-worker.ts` — Multi-worker pool lifecycle, progressive chunk rendering, rAF paint batching, draft/full upscaling
  - `use-url-state.ts` — Two-way sync between ViewState and URL hash (debounced 200ms)
  - `use-interaction.ts` — Pointer drag (with pixel-shifting), wheel zoom, pinch-to-zoom, double-click; draft/full/skip quality tiers
- `src/lib/mandelbrot/` — Core computation library
  - `types.ts` — ViewState, RenderRequest, RenderResult, ChunkResult, RenderComplete, ColorScheme interfaces
  - `colors.ts` — 7 color palettes with linear RGB interpolation (cycling every 256 iterations); palette swatch generation; brand gradient/glow color extraction
  - `url-state.ts` — URL hash serialization (15-digit precision for deep zoom) with debounced replaceState; DEFAULT_VIEW definition
  - `compute.ts` — Escape-time algorithm with cardioid/period-2 bulb skip, smooth coloring via double-log normalization, band-based and full-frame computation
  - `worker.ts` — Web Worker: band-based streaming RGBA output with zero-copy ArrayBuffer transfer, multi-worker round-robin distribution
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/styles/global.css` — Global theme with OKLCH CSS custom properties, dark mode, fullscreen body, `glass` and `glass-subtle` utility classes
- `public/` — PWA assets: `manifest.webmanifest`, `sw.js`, `icon-192.svg`, `favicon.svg`

### Import Aliases

All source imports use `@/*` which maps to `./src/*` (configured in tsconfig.json and components.json).

## Quality Gates & Strictness

- TypeScript is configured for a **very strict** safety profile on top of `astro/tsconfigs/strict` (including `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, and other defensive compiler flags).
- ESLint uses strict, type-aware flat config with TypeScript, React, React Hooks, and JSX a11y rules.
- `yarn lint` enforces `--max-warnings=0`; warnings are treated as failures in normal workflow.
- `yarn healthcheck` is the primary pre-PR/pre-merge command and should pass before shipping.

## React Entrypoint Policy

- React islands should be wrapped in `React.StrictMode` at entrypoints.
- The main app island mounts `src/components/mandelbrot/MandelbrotExplorer.tsx` from `src/pages/index.astro` with `client:load`, and `StrictMode` is applied inside the component.

## Editor Diagnostics (VSCode/Cursor)

- Tailwind v4 directives like `@custom-variant`, `@theme`, and `@apply` are valid for this project but may be flagged by the built-in CSS validator as `unknownAtRules`.
- Workspace settings in `.vscode/settings.json` intentionally suppress those false positives (`css/scss/less.lint.unknownAtRules = ignore`).
- Tailwind IntelliSense canonical class suggestions are generally worth applying (for example `border-white/[0.08]` → `border-white/8`).

## Interaction Model — Draft/Full/Skip Quality Tiers

The core UX innovation is a **multi-tier rendering strategy** that decouples visual feedback from computational accuracy:

### Draft Tier (during zoom interaction)

- Triggered immediately on wheel zoom and pinch-to-zoom
- Renders at **50% resolution** (`DRAFT_SCALE = 0.5` → 25% pixel area), upscaled with bilinear filtering via `ctx.drawImage`

### Skip Tier (during pan)

- During pan/drag: existing canvas pixels are **shifted in-place** via `ctx.drawImage(canvas, dx, dy)` (instant visual feedback, zero compute needed)
- Exposed strips cleared to black; no render is dispatched at all
- Only the view state and URL are updated; the debounced full render fires after the user stops

### Full Tier (after interaction)

- Scheduled **50ms** after the last interaction event (debounced)
- Renders at native canvas resolution for final high-fidelity output
- Double-click is the exception: immediately triggers full render (it's a "decisive" action)
- Also triggered by: settings changes, reset, resize, and browser back/forward navigation

### Interaction Handlers

| Input             | Behavior                                                   | Quality             |
| ----------------- | ---------------------------------------------------------- | ------------------- |
| **Click-drag**    | Pan via pointer capture; pixel-shift canvas, update center | Skip → Full (50ms)  |
| **Mouse wheel**   | ±10% zoom toward cursor; preserves focus point             | Draft → Full (50ms) |
| **Double-click**  | 2× zoom into click position                                | Immediate Full      |
| **Pinch (touch)** | Two-finger zoom based on distance delta                    | Draft → Full (50ms) |

### Auto-Iterations

`autoIterations(zoom)` scales max iterations with zoom depth: `200 + 50 × log₂(3.5/zoom)`, clamped to [200, 5000]. Each doubling of magnification adds 50 iterations. Deeper zooms automatically get more detail without user intervention.

## Rendering Pipeline

```
User Interaction
    │
    ▼
MandelbrotExplorer (orchestrator)
    │ applies DRAFT_SCALE or 1.0
    ▼
useMandelbrotWorker → posts RenderRequest with requestId to N workers
    │
    ├──► Worker 0: bands 0, N, 2N, ...
    ├──► Worker 1: bands 1, N+1, 2N+1, ...
    ├──► Worker 2: bands 2, N+2, 2N+2, ...
    │    ...
    │
    ▼
Each worker, for each assigned band:
    │ computeBand() → Float64Array of smooth iteration counts
    │ mapToColors() → Uint8ClampedArray RGBA buffer
    │ postMessage(ChunkResult, [buffer]) ← zero-copy Transferable
    │ setTimeout(nextBand, 0) ← yields to allow cancellation
    │
    ▼
Main Thread receives chunks (from all workers)
    │ queues in pendingChunksRef
    │ paints via requestAnimationFrame (batched, one flush per frame)
    │ draft chunks: drawn to temp canvas, scaled up via drawImage
    │ full chunks: putImageData directly at correct y offset
    │
    ▼
RenderProgress updates (circular SVG, bottom-right)
    │ tracks pixelsReceived / totalPixels across all workers
    │ hides when all workers send "complete"
```

### Multi-Worker Parallelism

The worker pool size is `Math.min(navigator.hardwareConcurrency, 16)`, typically 4–16 workers. Each worker receives the same RenderRequest but with a different `workerIndex`, causing them to process interleaved bands (round-robin striping). This ensures the image fills in evenly from all regions rather than top-to-bottom.

### Cancellation

Each render gets a monotonic `requestId`. Starting a new render increments the ID, which implicitly cancels all in-progress work:

- **Workers**: check `currentRequestId` between bands and silently abandon stale renders
- **Main thread**: drops chunks whose `requestId` doesn't match the current one

## Coordinate System Mapping

Three coordinate spaces are used throughout the codebase:

| Space             | Units                                            | Used by                              |
| ----------------- | ------------------------------------------------ | ------------------------------------ |
| **CSS pixels**    | `event.clientX/Y`, `getBoundingClientRect()`     | Interaction handlers                 |
| **Device pixels** | `canvas.width/height` = CSS × DPR (capped at 2)  | Canvas operations, worker dimensions |
| **Complex plane** | Real + Imaginary axis (mathematical coordinates) | ViewState, `compute.ts`              |

### Screen → Complex Plane Conversion

Given ViewState `(centerX, centerY, zoom)` and canvas dimensions `(width, height)`:

```
aspectRatio = width / height
xMin = centerX - (zoom/2) × aspectRatio    // left edge on real axis
yMin = centerY - (zoom/2)                  // top edge on imaginary axis
pixelWidth  = (zoom × aspectRatio) / width  // complex units per pixel (horizontal)
pixelHeight = zoom / height                 // complex units per pixel (vertical)

For pixel (px, py):
  x₀ = xMin + px × pixelWidth    // real component (Re)
  y₀ = yMin + py × pixelHeight   // imaginary component (Im)
```

### CSS → Complex Plane Conversion (for interaction)

Used during pan to convert mouse drag distance to complex-plane displacement:

```
scale = zoom / canvasElement.getBoundingClientRect().height
deltaComplex = deltaCSSPixels × scale
```

### "Zoom Toward Cursor" Math (wheel zoom)

The cursor point stays fixed on screen after zooming:

```
1. Find complex-plane point under cursor:
   worldX = centerX + (mouseX - 0.5) × zoom × aspectRatio
   worldY = centerY + (mouseY - 0.5) × zoom
   (where mouseX/Y are [0,1] fractions of canvas width/height)

2. Apply zoom factor:
   newZoom = zoom × factor   (factor = 1.1 for zoom-out, 1/1.1 for zoom-in)

3. Solve for new center so cursor point stays fixed:
   newCenterX = worldX - (mouseX - 0.5) × newZoom × aspectRatio
   newCenterY = worldY - (mouseY - 0.5) × newZoom
```

## Math & Algorithms

### Escape-Time Algorithm (`compute.ts`)

The Mandelbrot set is the set of complex numbers `c` for which the iteration `z_{n+1} = z_n² + c` (starting from `z₀ = 0`) does not diverge. In practice, we iterate up to `maxIter` times and check if `|z|²` exceeds a **bailout value** of 256 (radius 16).

The iteration is written in optimized form to avoid redundant multiplications:

- `x2 = x²` and `y2 = y²` are cached across iterations
- `z² = (x+yi)²` expands to `(x²-y²) + (2xy)i`
- New `y` is computed BEFORE new `x` because it needs the OLD `x` value

### Smooth Coloring

Raw integer iteration counts produce visible color "bands." The **normalized iteration count** formula eliminates this:

```
smoothed = iter + 1 - log₂(log₂(|z|))
         = iter + 1 - log(log(√(x²+y²))) / log(2)
```

The double-logarithm maps the residual escape magnitude to a smooth fractional value, producing gradient-like transitions. The high bailout value of 256 (instead of the minimal 4) gives the double-log formula more dynamic range.

### Cardioid / Period-2 Bulb Skip

Before running the expensive iteration loop, two analytical tests instantly identify points known to be inside the Mandelbrot set:

1. **Main cardioid** (the heart-shaped body): `q(q + (x₀ - ¼)) ≤ ¼y₀²` where `q = (x₀-¼)² + y₀²`
2. **Period-2 bulb** (the circular "head" at x=-1): `(x₀+1)² + y₀² ≤ 1/16`

These regions cover ~25% of visible pixels at the default zoom, saving significant computation.

### Color Palette Mapping

Each palette has 5 RGB color stops, evenly spaced across [0, 1]. The smooth iteration count is mapped to a color via:

```
t = (smoothIter % 256) / 256    // wraps every 256 iterations
color = interpolatePalette(palette, t)  // linear interpolation between stops
```

The modulo-256 cycling creates repeating color "contour lines" that prevent the palette from stretching to invisibility at high iteration counts.

## Performance Optimizations

| Technique               | Where                    | Impact                                                        |
| ----------------------- | ------------------------ | ------------------------------------------------------------- | --- | ---------------------------- |
| DPR capping at 2×       | MandelbrotCanvas         | Prevents 3×+ oversampling on mobile (2.25× memory savings)    |
| Draft scale 0.5         | MandelbrotExplorer       | 4× fewer pixels during interaction                            |
| Canvas pixel shifting   | use-interaction.ts       | Instant pan feedback, zero compute                            |
| Multi-worker pool       | use-mandelbrot-worker.ts | Parallel computation across all CPU cores (round-robin bands) |
| Band streaming (32px)   | worker.ts                | Interruptible renders, progressive display                    |
| Zero-copy transfer      | worker.ts postMessage    | No serialization cost or GC pressure on main thread           |
| Cardioid/bulb detection | compute.ts               | Skips ~25% of interior point iterations (geometrically exact) |
| Smooth coloring         | compute.ts               | `iter + 1 - log₂(log₂(                                        | z   | ))` eliminates color banding |
| High bailout (256)      | compute.ts               | More dynamic range for smooth coloring at negligible cost     |
| rAF paint batching      | use-mandelbrot-worker.ts | Single DOM flush per frame regardless of chunk arrival rate   |
| Debounced URL sync      | url-state.ts (200ms)     | Prevents history spam during smooth panning                   |
| Skip tier for pan       | use-interaction.ts       | No render dispatched at all during drag (pixel-shift only)    |

## URL State & Shareability

Views are persisted in the URL hash: `#x=-0.5&y=0&z=3.5&i=200&c=classic`

- **15-digit precision** for coordinates (near IEEE 754 double-precision limit, supports 10^14+ magnification)
- **10-digit precision** for zoom (sufficient for scale factor representation)
- **Debounced** at 200ms using `replaceState` (not `pushState`) to avoid history bloat
- **Two-way sync**: hash changes (back/forward buttons, manual URL edits) restore the view
- Copy the URL to share a specific deep-zoom location with anyone

## Color Palettes

7 palettes (classic, fire, ocean, grayscale, psychedelic, ice, neon), each defined as 5 RGB color stops with linear interpolation cycling every 256 iterations. Interior points (in-set) always render black.

The `getBrandColors()` function samples a palette's bright inner range (15%–85%) to generate a CSS linear gradient and glow color used for the "mandelbro" brand mark in the toolbar. The brand automatically adapts to the active color scheme.

## PWA & Mobile

- Installable standalone app (manifest + service worker)
- Service worker: network-first for navigation, cache-first for assets, auto-cleans old cache versions
- **Localhost guard**: service worker is automatically unregistered on localhost/127.0.0.1 to prevent caching issues during development
- `viewport-fit=cover` + `user-scalable=no` for immersive full-bleed display
- Touch-optimized: pinch-to-zoom, pointer capture for smooth drag outside viewport
- Black theme throughout (`#000000` background) for OLED efficiency

## UX Philosophy

1. **Immersive & Minimal** — The fractal IS the app. UI is floating glass-morphism overlays that auto-hide. Cursor is crosshair.
2. **Never Wait** — Draft renders during zoom, pixel-shifting during pan, full renders on idle. Band streaming for progressive reveal. Multi-worker parallelism for maximum throughput.
3. **Precision & Shareability** — 15-digit coordinates, auto-scaling iterations, URL hash for bookmarking and sharing. Copy coordinates from settings panel.
4. **Mobile-First PWA** — Installable, offline-capable, touch-native, fullscreen.

## Styling Conventions

- Tailwind v4 with `@tailwindcss/vite` plugin (not PostCSS)
- Theme colors use OKLCH color space via CSS custom properties (e.g. `--background`, `--primary`)
- Dark mode via `.dark` class on `<html>` (always-on for this app)
- Component variants use `class-variance-authority` (CVA)
- Always compose classes with the `cn()` utility from `@/lib/utils`
- Custom utility classes in `global.css`:
  - `.glass` — `bg-black/60 backdrop-blur-md border border-white/8 shadow-lg` (toolbar, settings panel)
  - `.glass-subtle` — `bg-black/40 backdrop-blur-sm border border-white/6` (coordinates HUD, progress indicator)

## Adding shadcn/ui Components

```sh
yarn shadcn add <component-name>
```

Configuration lives in `components.json`. Components are generated as TSX into `src/components/ui/`.

## State Architecture

The app uses a **ref-first state model** for performance:

- `viewRef` (React ref) — the authoritative ViewState, read synchronously by high-frequency event handlers to avoid stale-closure problems
- `viewForUI` (React state) — a mirror of `viewRef` that drives React re-renders for UI overlays (coordinates, settings panel)
- `sizeRef` (React ref) — canvas device-pixel dimensions, updated by ResizeObserver
- Both ref and state are always updated together in `handleViewChange`

This pattern avoids the classic React issue where `useState` values captured in closures become stale during rapid interaction events.
