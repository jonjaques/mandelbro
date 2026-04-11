# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Mandelbro** is a best-of-breed fullscreen Mandelbrot set explorer — an immersive, installable web app where the fractal _is_ the entire UI. The goal is Google Maps-level interaction fluidity applied to mathematical visualization: instant visual feedback during navigation, progressive high-fidelity rendering when idle, and shareable deep-zoom URLs.

The app supports **arbitrary-precision deep zoom** via perturbation theory, enabling zoom depths far beyond the IEEE 754 double-precision limit of ~10^14. Using a single high-precision reference orbit combined with native double-precision per-pixel perturbation deltas, Mandelbro can explore the Mandelbrot set at magnifications of 10^50 and beyond — all in the browser.

Every technical decision serves one UX principle: **the user should never wait for the math to catch up with their hands.**

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
  - `MandelbrotExplorer.tsx` — Root orchestrator: wires together state, dual rendering pipelines, interaction, URL sync, UI overlays, and the `StrictMode` wrapper
  - `MandelbrotCanvas.tsx` — Full-viewport `<canvas>` with ResizeObserver, DPR-aware (capped at 2x)
  - `Toolbar.tsx` — Floating glass-morphism buttons: settings, share URL, reset view, fullscreen toggle; **Reference** opens a modal of prior-art citations; brand mark with palette-adaptive gradient + glow
  - `SettingsPanel.tsx` — shadcn Sheet with iterations slider, color scheme selector, coordinate display with copy-to-clipboard, share URL, and reset
  - `Coordinates.tsx` — Bottom-left HUD showing Re/Im/zoom with full-precision display for deep zoom; auto-hides after 3s of inactivity, reappears on interaction or view change; shows "Precision mode" badge with digit count when past the precision threshold
  - `DeepZoomBanner.tsx` — Top-center banner that appears when the perturbation pipeline activates; shows zoom depth milestones (e.g., "10^30×") and fades after 4s
  - `RenderProgress.tsx` — Bottom-right circular SVG progress indicator (stroke-dashoffset animation), appears with 300ms delay during renders; in perturbation mode, 0–10% reflects reference orbit computation, 10–100% reflects pixel rendering
- `src/components/ui/` — shadcn/ui React components (generated via `yarn dlx shadcn` or `yarn shadcn` CLI)
- `src/hooks/` — React hooks (the core interaction and rendering logic lives here)
  - `use-mandelbrot-worker.ts` — Standard multi-worker pool lifecycle, progressive chunk rendering, and rAF paint batching for full-resolution renders (used when zoom ≥ 1e-13)
  - `use-perturbation-renderer.ts` — Two-phase perturbation rendering pipeline: Phase 1 computes a high-precision reference orbit (single worker), Phase 2 dispatches per-pixel perturbation deltas to a worker pool. Includes reference orbit caching. Used when zoom < 1e-13
  - `use-url-state.ts` — Two-way sync between ViewState and URL hash (debounced 200ms); supports arbitrary-precision coordinate strings
  - `use-interaction.ts` — Pointer drag (with pixel-shifting), wheel zoom, pinch-to-zoom, double-click; snapshot-based interaction previews with deferred commit renders; uses BigFloat arithmetic for high-precision pan/zoom deltas past the precision threshold
- `src/lib/mandelbrot/` — Core computation library
  - `types.ts` — ViewState (with optional high-precision `centerXHp`/`centerYHp`/`zoomHp` string fields), `PRECISION_THRESHOLD`, RenderRequest, ChunkResult, RenderComplete, ColorScheme, plus perturbation pipeline types: ReferenceOrbit, ReferenceOrbitRequest/Complete, PerturbationRenderRequest
  - `colors.ts` — 7 color palettes with linear RGB interpolation (cycling every 256 iterations); palette swatch generation; brand gradient/glow color extraction; shared `mapToColors()` used by both standard and perturbation workers
  - `url-state.ts` — URL hash serialization with arbitrary-precision support: uses `centerXHp`/`centerYHp`/`zoomHp` strings when available for deep-zoom shareability; debounced replaceState; DEFAULT_VIEW definition
  - `compute.ts` — Standard escape-time algorithm with cardioid/period-2 bulb skip, smooth coloring via double-log normalization, band-based and full-frame computation; `autoIterations` scales up to 10,000 for deep zoom
  - `worker.ts` — Standard Web Worker: band-based streaming RGBA output with zero-copy ArrayBuffer transfer, multi-worker round-robin distribution
  - `bigfloat-utils.ts` — Utility module wrapping `bigfloat-esnext` for Mandelbrot-specific use: `requiredPrecision(zoom)` maps zoom depth to needed decimal digits, `truncateToPrecision()` prevents coefficient explosion during BigFloat iteration, plus conversion helpers
  - `reference-orbit.ts` — Computes a single high-precision reference orbit at the view center using BigFloat arithmetic; stores orbit values as Float64Arrays for consumption by perturbation workers; includes Brent's cycle detection for interior point early termination; optionally computes Series Approximation (SA) coefficients alongside the orbit
  - `reference-orbit-worker.ts` — Web Worker wrapper that runs `computeReferenceOrbit` off the main thread, streaming progress updates and transferring Float64Array results
  - `perturbation.ts` — Perturbation escape-time formulas: iterates delta from reference orbit using native doubles, with glitch detection, smooth coloring, Series Approximation skip for iteration reduction, and band-based computation
  - `perturbation-worker.ts` — Web Worker for perturbation-based rendering: same band-streaming, round-robin, and cancellation architecture as worker.ts, but uses the perturbation formula instead of direct escape-time
  - `favorites.ts` — Favorite locations with high-precision coordinate support; preset locations and user-saved favorites
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

## Interaction Model — Preview Then Commit

The core UX innovation is a **preview/commit rendering strategy** that decouples visual feedback from computational accuracy:

### Preview Phase (during interaction)

- During pan/drag: existing canvas pixels are **shifted in-place** via `ctx.drawImage(canvas, dx, dy)` for instant feedback with zero compute
- During wheel zoom and pinch-to-zoom: the app snapshots the current canvas once, then scales/translates that cached image during the gesture
- Preview frames are intentionally blurry or pixelated when zoomed because they reuse already-rendered pixels instead of recalculating the fractal
- During preview, only the view state and URL are updated; no worker render is dispatched yet
- At deep zoom, coordinate updates during interaction use BigFloat arithmetic (`applyHpDelta`) to maintain precision past the double-precision limit

### Commit Phase (after interaction)

- Scheduled **50–140ms** after the last continuous interaction event (debounced, varies by gesture type)
- Dispatches either a standard worker render or a perturbation pipeline render depending on the current zoom depth
- Double-click is the exception: it immediately commits a full render because it's a single decisive action
- Also triggered by: settings changes, reset, resize, and browser back/forward navigation

### Interaction Handlers

| Input             | Behavior                                                   | Quality          |
| ----------------- | ---------------------------------------------------------- | ---------------- |
| **Click-drag**    | Pan via pointer capture; pixel-shift canvas, update center | Preview → Commit |
| **Mouse wheel**   | ±10% zoom toward cursor; preserves focus point             | Preview → Commit |
| **Double-click**  | 2× zoom into click position                                | Immediate Full   |
| **Pinch (touch)** | Two-finger zoom based on distance delta                    | Preview → Commit |

### Auto-Iterations

`autoIterations(zoom)` scales max iterations with zoom depth: `200 + 50 × log₂(3.5/zoom)`, clamped to [200, 10000]. Each doubling of magnification adds 50 iterations. Deeper zooms automatically get more detail without user intervention. The 10,000 cap balances detail against compute cost in the perturbation pipeline, where each pixel iterates up to maxIter times across multiple workers.

## Dual Rendering Pipeline

The app maintains two rendering pipelines and switches between them automatically based on zoom depth:

### Standard Pipeline (zoom ≥ 1e-13)

```
User Interaction
    │
    ▼
MandelbrotExplorer (orchestrator)
    │ updates ViewState and schedules commit renders
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
    │ full chunks: putImageData directly at correct y offset
    │
    ▼
RenderProgress updates (circular SVG, bottom-right)
    │ tracks pixelsReceived / totalPixels across all workers
    │ hides when all workers send "complete"
```

### Perturbation Pipeline (zoom < 1e-13)

When the zoom depth passes `PRECISION_THRESHOLD` (1e-13), the app switches to a two-phase perturbation pipeline that uses arbitrary-precision arithmetic:

```
User Interaction
    │
    ▼
MandelbrotExplorer (orchestrator)
    │ detects view.zoom < PRECISION_THRESHOLD
    │ routes to usePerturbationRenderer
    ▼
Phase 1: Reference Orbit (single worker)
    │ reference-orbit-worker receives centerXHp/centerYHp strings
    │ computeReferenceOrbit() using bigfloat-esnext:
    │   - BigFloat z_{n+1} = z_n^2 + c with truncation
    │   - Stores orbit as Float64Array (re/im)
    │   - Brent's cycle detection for interior points
    │   - Series Approximation coefficients (A, B, C)
    │ Posts progress (0-10% of total)
    │ Transfers Float64Arrays to main thread
    ▼
Phase 2: Perturbation Render (worker pool)
    │ Reference orbit + SA coefficients distributed to N workers
    │
    ├──► Worker 0: bands 0, N, 2N, ...
    ├──► Worker 1: bands 1, N+1, ...
    ├──► Worker N-1: ...
    │
    │ For each pixel in each band:
    │   1. SA skip: evaluate A*δ + B*δ² + C*δ³ to skip early iterations
    │   2. perturbationEscapeTime(): δ_{n+1} = 2X_n·δ_n + δ_n² + ε
    │   3. smoothColor() → mapToColors() → RGBA buffer
    │
    ▼
Main Thread (same chunk painting as standard pipeline)
    │ Progress: 10-100% as pixel chunks arrive
    │ Canvas putImageData, rAF batching
```

### Pipeline Switching

`MandelbrotExplorer` manages both `useMandelbrotWorker` and `usePerturbationRenderer` hooks simultaneously. The `triggerRender` callback checks `view.zoom < PRECISION_THRESHOLD` and dispatches to the appropriate pipeline, cancelling the other. Both pipelines produce identical `ChunkResult` messages, so all UI overlays (progress, coordinates, etc.) work unchanged.

### Reference Orbit Caching

The perturbation renderer caches reference orbits keyed by `centerReStr|centerImStr|maxIter`. When only zoom changes (center unchanged), the cached orbit is reused, skipping Phase 1 entirely. This makes zoom-only operations significantly faster at deep zoom.

### Multi-Worker Parallelism

**Standard pipeline**: worker pool size is `Math.min(navigator.hardwareConcurrency, 16)`, typically 4–16 workers.

**Perturbation pipeline**: uses `Math.floor(hardwareConcurrency / 2)`, clamped to [2, 8]. Perturbation is more CPU-intensive per pixel (thousands of iterations at deep zoom), so fewer workers prevent thermal throttling and leave headroom for the browser.

Both pipelines use round-robin band distribution: worker N processes bands N, N+count, N+2\*count, etc. This ensures the image fills in evenly from all regions.

### Cancellation

Each render gets a monotonic `requestId`. Starting a new render increments the ID, which implicitly cancels all in-progress work:

- **Workers**: check `currentRequestId` between bands and silently abandon stale renders
- **Main thread**: drops chunks whose `requestId` doesn't match the current one
- **Reference orbit worker**: checks cancellation between iteration batches

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

The cursor point stays fixed on screen after zooming. At deep zoom, the implementation uses **algebraic delta** math to avoid catastrophic cancellation:

```
// Instead of: worldX = center + offset; newCenter = worldX - newOffset
// (which loses precision when offset ≈ newOffset at deep zoom)
// We compute: delta = (mousePos - 0.5) * aspect * (zoom - newZoom)

1. Compute zoom factor:
   newZoom = zoom × factor   (factor = 1.1 for zoom-out, 1/1.1 for zoom-in)

2. Compute center delta directly:
   zoomDelta = zoom - newZoom
   dxComplex = (mouseX - 0.5) × aspectRatio × zoomDelta
   dyComplex = (mouseY - 0.5) × zoomDelta

3. Apply delta to center (with BigFloat when past precision threshold):
   newCenterX = centerX + dxComplex
   newCenterY = centerY + dyComplex
```

## Math & Algorithms

### Standard Escape-Time Algorithm (`compute.ts`)

The Mandelbrot set is the set of complex numbers `c` for which the iteration `z_{n+1} = z_n² + c` (starting from `z₀ = 0`) does not diverge. In practice, we iterate up to `maxIter` times and check if `|z|²` exceeds a **bailout value** of 256 (radius 16).

The iteration is written in optimized form to avoid redundant multiplications:

- `x2 = x²` and `y2 = y²` are cached across iterations
- `z² = (x+yi)²` expands to `(x²-y²) + (2xy)i`
- New `y` is computed BEFORE new `x` because it needs the OLD `x` value

### Perturbation Theory (`perturbation.ts`, `reference-orbit.ts`)

Rather than computing every pixel with expensive arbitrary-precision math (500x+ slower), we use **perturbation theory** (K. I. Martin, "Superfractalthing Maths"):

1. Compute **one reference orbit** at the view center using `bigfloat-esnext` (slow, but only once)
2. For each pixel, compute only its **delta from the reference** using native doubles (fast, parallelizable)

The key identity: if `Z_n = X_n + delta_n` where `X_n` is the reference orbit:

```
delta_{n+1} = 2 * X_n * delta_n + delta_n^2 + epsilon
```

where `epsilon = c_pixel - c_reference` is the pixel's offset from the reference point. Since `epsilon` and `delta_n` are small at deep zoom, native doubles have plenty of precision.

### Series Approximation (iteration skipping)

The perturbation `delta_n` can be expressed as a **power series**:

```
delta_n = A_n * ε + B_n * ε² + C_n * ε³
```

where A, B, C coefficients are computed once alongside the reference orbit (using only double-precision reference values) and are the same for ALL pixels. For any pixel, we can jump directly to iteration `n` by evaluating the series, skipping `n` iterations entirely.

At deep zoom, `ε` is tiny (proportional to `zoom / width`), so higher-order terms shrink rapidly. Series approximation can skip 50–90% of iterations for most pixels, yielding 2–10x speedup on top of perturbation alone.

### Brent's Cycle Detection

Interior Mandelbrot points never escape but waste maxIter iterations. Brent's algorithm detects cycles in the orbit sequence and terminates early:

- Integrated into the reference orbit computation
- Uses double-precision orbit values with a tolerance of 1e-12
- When a cycle is detected, the orbit is extended by repeating the period to fill the full maxIter length (enabling perturbation workers to use the complete orbit)

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

These regions cover ~25% of visible pixels at the default zoom, saving significant computation. (Used by the standard pipeline only; at deep zoom the perturbation pipeline handles interior detection via cycle detection and iteration limits.)

### Color Palette Mapping

Each palette has 5 RGB color stops, evenly spaced across [0, 1]. The smooth iteration count is mapped to a color via:

```
t = (smoothIter % 256) / 256    // wraps every 256 iterations
color = interpolatePalette(palette, t)  // linear interpolation between stops
```

The modulo-256 cycling creates repeating color "contour lines" that prevent the palette from stretching to invisibility at high iteration counts.

## Performance Optimizations

| Technique                | Where                             | Impact                                                          |
| ------------------------ | --------------------------------- | --------------------------------------------------------------- | --- | ---------------------------- |
| DPR capping at 2×        | MandelbrotCanvas                  | Prevents 3×+ oversampling on mobile (2.25× memory savings)      |
| Canvas pixel shifting    | use-interaction.ts                | Instant pan feedback, zero compute                              |
| Snapshot preview scaling | use-interaction.ts                | Smooth wheel/pinch zoom feedback without recomputing fractals   |
| Multi-worker pool        | use-mandelbrot-worker.ts          | Parallel computation across all CPU cores (round-robin bands)   |
| Band streaming (4–32px)  | worker.ts, perturbation-worker.ts | Interruptible renders, progressive display                      |
| Zero-copy transfer       | worker.ts postMessage             | No serialization cost or GC pressure on main thread             |
| Cardioid/bulb detection  | compute.ts                        | Skips ~25% of interior point iterations (geometrically exact)   |
| Smooth coloring          | compute.ts, perturbation.ts       | `iter + 1 - log₂(log₂(                                          | z   | ))` eliminates color banding |
| High bailout (256)       | compute.ts, perturbation.ts       | More dynamic range for smooth coloring at negligible cost       |
| rAF paint batching       | use-mandelbrot-worker.ts          | Single DOM flush per frame regardless of chunk arrival rate     |
| Debounced URL sync       | url-state.ts (200ms)              | Prevents history spam during smooth panning                     |
| Deferred commit renders  | use-interaction.ts                | Avoids redundant recomputation while gestures are in flight     |
| Perturbation theory      | perturbation.ts                   | Eliminates BigFloat cost for all but 1 reference point          |
| Series Approximation     | perturbation.ts                   | Skips 50–90% of early iterations per pixel at deep zoom         |
| Brent's cycle detection  | reference-orbit.ts                | Early-terminates interior reference points                      |
| Reference orbit caching  | use-perturbation-renderer.ts      | Reuses orbit when only zoom changes (center unchanged)          |
| Algebraic delta zoom     | use-interaction.ts                | Avoids catastrophic cancellation at deep zoom coordinates       |
| BigFloat truncation      | bigfloat-utils.ts                 | Prevents coefficient explosion during reference orbit iteration |
| Adaptive band height     | perturbation-worker.ts            | Smaller bands (4px) at high maxIter for responsive cancellation |

## URL State & Shareability

Views are persisted in the URL hash: `#x=-0.5&y=0&z=3.5&i=200&c=classic&aa=auto`

- **Arbitrary-precision coordinates**: when `centerXHp`/`centerYHp`/`zoomHp` strings are present (deep zoom), the full-precision decimal strings are serialized directly, preserving every digit. This enables sharing deep-zoom locations far beyond double-precision limits.
- **15-digit precision** for standard coordinates (near IEEE 754 double-precision limit, supports 10^14+ magnification)
- **10-digit precision** for zoom (sufficient for scale factor representation)
- **Debounced** at 200ms using `replaceState` (not `pushState`) to avoid history bloat
- **Two-way sync**: hash changes (back/forward buttons, manual URL edits) restore the view; high-precision strings detected by coordinate length (>16 chars for x/y, >11 chars for z)
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
2. **Never Wait** — Snapshot previews during zoom, pixel-shifting during pan, full commit renders on idle. Band streaming for progressive reveal. Multi-worker parallelism for maximum throughput. Perturbation theory for deep-zoom speed.
3. **Infinite Depth** — Arbitrary-precision deep zoom via perturbation theory lets users explore the Mandelbrot set at magnifications of 10^50+ without hitting precision limits. The pipeline switches seamlessly — users just keep zooming.
4. **Precision & Shareability** — Arbitrary-precision coordinates, auto-scaling iterations, URL hash for bookmarking and sharing. Copy coordinates from settings panel. Share deep-zoom locations with full precision.
5. **Mobile-First PWA** — Installable, offline-capable, touch-native, fullscreen.

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

### High-Precision State

ViewState carries optional `centerXHp`, `centerYHp`, and `zoomHp` string fields for arbitrary-precision coordinates. These are:

- Created automatically by `applyHpDelta()` in `use-interaction.ts` when zooming past `PRECISION_THRESHOLD`
- Serialized to/from the URL hash by `url-state.ts`
- Passed to the perturbation renderer for reference orbit computation
- Displayed in the coordinates HUD with truncated precision for readability

## Arbitrary-Precision Deep Zoom — Technical Details

### Precision Threshold

`PRECISION_THRESHOLD = 1e-13` — the zoom level where adjacent pixels approach the IEEE 754 double limit. Below this, the app switches from the standard pipeline to perturbation.

### BigFloat Library

`bigfloat-esnext` provides arbitrary-precision arithmetic via BigInt coefficients. Key concern: `mul()` is exact (coefficients grow without bound), so `truncateToPrecision()` must be called after every squaring to shed excess digits. Without truncation, the computation becomes exponentially slower.

`requiredPrecision(zoom)` determines how many decimal digits are needed: `ceil(-log10(zoom)) + 10`. At zoom 1e-50, this yields ~60 digits.

### Glitch Handling

When `|delta| >> |X|`, the perturbation approximation breaks down (glitch). The `GLITCH_THRESHOLD` (1e3) detects this condition. For v1, glitched pixels render with potentially inaccurate colors. Future work: automatic re-referencing near glitched regions.

### Known Limitations

- Reference orbit computation is capped at 10,000 iterations (`MAX_SAFE_ITERATIONS`) to bound BigFloat computation time
- Single-reference perturbation can produce visual glitches near mini-Mandelbrot copies (multi-reference not yet implemented)
- `zoomHp` is present in the ViewState type but interaction handlers currently use double-precision zoom (sufficient because zoom is a scale factor, not a position)

## Deployment

The project is deployed on **Cloudflare Pages** via git-based CI (pushes to tracked branches auto-deploy).

| Branch     | URL                                   | Purpose                         |
| ---------- | ------------------------------------- | ------------------------------- |
| `main`     | https://mandelbro.jonjaques.com       | Production (standard pipeline)  |
| `bigfloat` | https://bigfloat.mandelbro.pages.dev/ | Preview (perturbation/bigfloat) |

Both deployments share the same URL hash format, so any `#x=...&y=...&z=...` hash is compatible between branches. This enables cross-branch comparison by replacing the hostname while preserving the hash.

A **Compare** button in the Toolbar (visible on both deployments) opens the same coordinates on the other branch in a new tab. This lets users visually compare the standard double-precision pipeline (production) against the arbitrary-precision perturbation pipeline (bigfloat) at the same location and zoom.

## References

- K. I. Martin, ["Superfractalthing Maths"](https://web.archive.org/web/20140628114658/http://www.superfractalthing.co.nf/sft_maths.pdf) — perturbation theory formulation
- [Plotting algorithms for the Mandelbrot set (Wikipedia)](https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set) — perturbation, series approximation, periodicity checking
- [Cycle detection (Wikipedia)](https://en.wikipedia.org/wiki/Cycle_detection#Brent's_algorithm) — Brent's algorithm
