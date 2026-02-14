# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Mandelbro** is a best-of-breed fullscreen Mandelbrot set explorer — an immersive, installable web app where the fractal *is* the entire UI. The goal is Google Maps-level interaction fluidity applied to mathematical visualization: instant visual feedback during navigation, progressive high-fidelity rendering when idle, and shareable deep-zoom URLs. Every technical decision serves one UX principle: **the user should never wait for the math to catch up with their hands.**

## Build & Development Commands

```sh
npm run dev       # Start dev server with HMR
npm run build     # Production build to /dist
npm run preview   # Preview production build locally
```

No test framework or linter is currently configured.

## Architecture

**Astro 5 + React 19** hybrid static site using **Tailwind CSS v4** and **shadcn/ui** components (new-york style). Astro provides the zero-JS static shell; a single React island (`client:load`) runs the entire explorer.

### Dual Component Model
- **Astro components** (`.astro`) — server-rendered, zero JS by default. Used for pages and layouts.
- **React components** (`.tsx`) — client-side interactive islands, hydrated with `client:load` directive.

### Directory Layout
- `src/pages/` — File-based routing (Astro pages); `index.astro` is the fullscreen dark app shell
- `src/layouts/` — Page layout templates
- `src/components/mandelbrot/` — React components for the explorer UI
  - `MandelbrotExplorer.tsx` — Root component, state orchestrator, refs for view/size/canvas
  - `MandelbrotCanvas.tsx` — Full-viewport canvas with ResizeObserver, DPR-aware (capped at 2x)
  - `Toolbar.tsx` — Floating glass-morphism buttons: settings, reset view, fullscreen toggle
  - `SettingsPanel.tsx` — shadcn Sheet with iterations slider and color scheme selector
  - `Coordinates.tsx` — Bottom-left HUD showing Re/Im/zoom, auto-hides after 3s of inactivity
- `src/components/ui/` — shadcn/ui React components (generated via `npx shadcn` CLI)
- `src/hooks/` — React hooks (the core interaction and rendering logic lives here)
  - `use-mandelbrot-worker.ts` — Worker lifecycle, progressive chunk rendering, rAF paint batching
  - `use-url-state.ts` — Two-way sync between ViewState and URL hash (debounced 200ms)
  - `use-interaction.ts` — Pointer drag, wheel zoom, pinch-to-zoom, double-click; draft/full quality tiers
- `src/lib/mandelbrot/` — Core computation library
  - `types.ts` — ViewState, RenderRequest, RenderResult, ColorScheme interfaces
  - `colors.ts` — 7 color palettes with linear RGB interpolation (cycling every 256 iterations)
  - `url-state.ts` — URL hash serialization (15-digit precision for deep zoom) with debounced replaceState
  - `compute.ts` — Escape-time algorithm with cardioid/period-2 bulb skip, smooth coloring
  - `worker.ts` — Web Worker: band-based streaming RGBA output with zero-copy ArrayBuffer transfer
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/styles/global.css` — Global theme with OKLCH CSS custom properties, dark mode, fullscreen body
- `public/` — PWA assets: `manifest.webmanifest`, `sw.js`, `icon-192.svg`

### Import Aliases
All source imports use `@/*` which maps to `./src/*` (configured in tsconfig.json and components.json).

## Interaction Model — Draft/Full Quality Tiers

The core UX innovation is a **dual-tier rendering strategy** that decouples visual feedback from computational accuracy:

### Draft Tier (during interaction)
- Triggered immediately on pointer drag, wheel zoom, and pinch-to-zoom
- Renders at **50% resolution** (`DRAFT_SCALE = 0.5` → 25% pixel area), upscaled with bilinear filtering
- During pan: existing canvas pixels are **shifted in-place** (instant visual feedback, no compute needed), exposed strips cleared to black
- During zoom: draft render fires immediately toward cursor position

### Full Tier (after interaction)
- Scheduled **150ms** after the last interaction event (debounced)
- Renders at native canvas resolution for final high-fidelity output
- Double-click is the exception: immediately triggers full render (it's a "decisive" action)

### Interaction Handlers
| Input | Behavior | Quality |
|---|---|---|
| **Click-drag** | Pan via pointer capture; pixel-shift canvas, update center | Draft → Full |
| **Mouse wheel** | ±10% zoom toward cursor; preserves focus point | Draft → Full |
| **Double-click** | 2x zoom into click position | Immediate Full |
| **Pinch (touch)** | Two-finger zoom based on distance delta | Draft → Full |

### Auto-Iterations
`autoIterations(zoom)` scales max iterations with zoom depth: `200 + 50 * log₂(3.5/zoom)`, clamped to [200, 5000]. Deeper zooms automatically get more detail without user intervention.

## Rendering Pipeline

```
User Interaction
    │
    ▼
MandelbrotExplorer (orchestrator)
    │ applies DRAFT_SCALE or 1.0
    ▼
useMandelbrotWorker → posts RenderRequest with requestId
    │
    ▼
Worker Thread (worker.ts)
    │ divides canvas into 32px horizontal bands
    │ for each band:
    │   computeBand() → Float64Array of iteration counts
    │   mapToColors() → Uint8ClampedArray RGBA buffer
    │   postMessage(ChunkResult, [buffer]) ← zero-copy transfer
    │   setTimeout(nextBand, 0) ← yields to allow cancellation
    │
    ▼
Main Thread receives chunks
    │ queues in pendingChunksRef
    │ paints via requestAnimationFrame (batched)
    │ draft chunks: drawn to temp canvas, scaled up via drawImage
    │ full chunks: putImageData directly
    │
    ▼
Progress indicator updates (circular, bottom-right)
```

**Cancellation:** Each render gets a monotonic `requestId`. If a new request arrives, the worker checks `currentRequestId` between bands and abandons stale work.

## Performance Optimizations

| Technique | Where | Impact |
|---|---|---|
| DPR capping at 2x | MandelbrotCanvas | Prevents 3x+ oversampling on mobile (4x memory savings) |
| Draft scale 0.5 | MandelbrotExplorer | 4x fewer pixels during interaction |
| Canvas pixel shifting | use-interaction.ts | Instant pan feedback, zero compute |
| Band streaming (32px) | worker.ts | Interruptible renders, progressive display |
| Zero-copy transfer | worker.ts postMessage | No GC pressure on main thread |
| Cardioid/bulb detection | compute.ts | Skips ~25% of interior point iterations (geometrically exact) |
| Smooth coloring | compute.ts | `iter + 1 - log₂(log₂(√|z|²))` eliminates color banding |
| rAF paint batching | use-mandelbrot-worker.ts | Single DOM flush per frame |
| Debounced URL sync | url-state.ts (200ms) | Prevents history spam during smooth panning |

## URL State & Shareability

Views are persisted in the URL hash: `#x=-0.5&y=0&z=3.5&i=200&c=classic`

- **15-digit precision** for coordinates (supports 100+ orders of magnitude zoom)
- **Debounced** at 200ms to avoid history bloat
- **Two-way sync**: hash changes (back/forward buttons) restore the view
- Copy the URL to share a specific deep-zoom location with anyone

## Color Palettes

7 palettes (classic, fire, ocean, grayscale, psychedelic, ice, neon), each defined as 5 RGB color stops with linear interpolation cycling every 256 iterations. Interior points (in-set) always render black.

## PWA & Mobile

- Installable standalone app (manifest + service worker)
- Service worker: network-first for navigation, cache-first for assets, auto-cleans old cache versions
- `viewport-fit=cover` + `user-scalable=no` for immersive full-bleed display
- Touch-optimized: pinch-to-zoom, pointer capture for smooth drag outside viewport
- Black theme throughout (`#000000` background) for OLED efficiency

## UX Philosophy

1. **Immersive & Minimal** — The fractal IS the app. UI is floating glass-morphism overlays that auto-hide. Cursor is crosshair.
2. **Never Wait** — Draft renders during motion, full renders on idle. Pixel shifting for instant pan. Band streaming for progressive reveal.
3. **Precision & Shareability** — 15-digit coordinates, auto-scaling iterations, URL hash for bookmarking and sharing.
4. **Mobile-First PWA** — Installable, offline-capable, touch-native, fullscreen.

## Styling Conventions

- Tailwind v4 with `@tailwindcss/vite` plugin (not PostCSS)
- Theme colors use OKLCH color space via CSS custom properties (e.g. `--background`, `--primary`)
- Dark mode via `.dark` class toggle
- Component variants use `class-variance-authority` (CVA)
- Always compose classes with the `cn()` utility from `@/lib/utils`

## Adding shadcn/ui Components

```sh
npx shadcn add <component-name>
```

Configuration lives in `components.json`. Components are generated as TSX into `src/components/ui/`.
