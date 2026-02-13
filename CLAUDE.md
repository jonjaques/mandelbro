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

This is an **Astro 5 + React 19** hybrid static site using **Tailwind CSS v4** and **shadcn/ui** components (new-york style).

### Dual Component Model
- **Astro components** (`.astro`) — server-rendered, zero JS by default. Used for pages and layouts.
- **React components** (`.tsx`) — client-side interactive islands, hydrated with `client:load` directive.

### Directory Layout
- `src/pages/` — File-based routing (Astro pages + MDX content)
- `src/layouts/` — Page layout templates
- `src/components/` — Astro wrapper components
- `src/components/ui/` — shadcn/ui React components (generated via `npx shadcn` CLI)
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/styles/global.css` — Global theme with OKLCH CSS custom properties, dark mode support

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
