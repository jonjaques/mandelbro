# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```sh
npm run dev       # Start dev server with HMR
npm run build     # Production build to /dist
npm run preview   # Preview production build locally
```

No test framework or linter is currently configured.

## Architecture

This is an **Astro 5 + React 19** hybrid static site using **Tailwind CSS v4** and **shadcn/ui** components (new-york style). The app is a fullscreen interactive Mandelbrot set explorer with PWA support.

### Dual Component Model
- **Astro components** (`.astro`) — server-rendered, zero JS by default. Used for pages and layouts.
- **React components** (`.tsx`) — client-side interactive islands, hydrated with `client:load` directive.

### Directory Layout
- `src/pages/` — File-based routing (Astro pages); `index.astro` is the fullscreen dark app shell
- `src/layouts/` — Page layout templates
- `src/components/mandelbrot/` — React components for the explorer UI
  - `MandelbrotExplorer.tsx` — Root component wiring everything together
  - `MandelbrotCanvas.tsx` — Full-viewport canvas with ResizeObserver, DPR-aware (capped at 2x)
  - `Toolbar.tsx` — Floating buttons: settings, reset view, fullscreen toggle
  - `SettingsPanel.tsx` — shadcn Sheet with iterations slider and color scheme selector
  - `Coordinates.tsx` — Bottom-left HUD showing Re/Im/zoom, auto-hides after 3s
- `src/components/ui/` — shadcn/ui React components (generated via `npx shadcn` CLI)
- `src/hooks/` — React hooks
  - `use-mandelbrot-worker.ts` — Worker lifecycle, sends render requests, returns ImageData
  - `use-url-state.ts` — Two-way sync between ViewState and URL hash
  - `use-interaction.ts` — Pointer drag (pan), wheel (zoom), pinch-to-zoom, double-click zoom, draft/full quality tiers
- `src/lib/mandelbrot/` — Core computation library
  - `types.ts` — ViewState, RenderRequest, RenderResult, ColorScheme interfaces
  - `colors.ts` — 7 color palettes (classic, fire, ocean, grayscale, psychedelic, ice, neon) with interpolation
  - `url-state.ts` — URL hash serialization/deserialization with debounced replaceState
  - `compute.ts` — Escape-time algorithm with cardioid optimization, smooth coloring
  - `worker.ts` — Web Worker that computes frames and transfers RGBA buffers (zero-copy)
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/styles/global.css` — Global theme with OKLCH CSS custom properties, dark mode, fullscreen body
- `public/` — PWA assets: `manifest.webmanifest`, `sw.js`, `icon-192.svg`

### Import Aliases
All source imports use `@/*` which maps to `./src/*` (configured in tsconfig.json and components.json).

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
