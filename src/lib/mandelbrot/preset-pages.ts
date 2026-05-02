/**
 * Per-location SEO landing pages for famous Mandelbrot set locations.
 *
 * Each entry produces a server-rendered page at `/<slug>` that:
 *   1. Has a unique title, meta description, H1, and ~200-word body — so it
 *      can rank on long-tail queries like "seahorse valley mandelbrot".
 *   2. Deep-links into the explorer with the right view encoded in the URL
 *      hash, so visitors land directly on the location.
 *
 * Coordinates here mirror the in-app `PRESET_FAVORITES` (favorites.ts). The
 * two lists must stay in sync — when a preset is added, removed, or its
 * coordinates change, update both. Co-locating them in one file would be
 * cleaner, but `favorites.ts` is currently consumed only by the React
 * client and `preset-pages.ts` is consumed only by Astro pages, so keeping
 * them separate avoids dragging React types into the page build.
 */

import { locationPageDescription, locationPageTitle } from "./constants";
import type { ColorScheme } from "./color-schemes";

export interface PresetLandingPage {
  /** URL-safe slug; becomes the route, `/<slug>`. */
  slug: string;
  /** Computed `/<slug>` route — convenience for templates. */
  path: string;
  /** Display name, used in headings and the visible nav. */
  name: string;
  /** Real (x) coordinate at the view center, complex-plane units. */
  centerX: number;
  /** Imaginary (y) coordinate at the view center, complex-plane units. */
  centerY: number;
  /** Viewport height in complex-plane units (smaller = deeper zoom). */
  zoom: number;
  /** Color palette to open with. */
  colorScheme: ColorScheme;
  /** Iteration count to open with. */
  maxIter: number;
  /** ~10–18 word summary used in the homepage internal-link list. */
  shortSummary: string;
  /** ~25–40 word summary used in the page meta description. */
  metaSummary: string;
  /** ~80–150 word body paragraph for the landing page. */
  body: string;
  /** Computed page title — `locationPageTitle(name)`. */
  title: string;
  /** Computed page meta description — `locationPageDescription(name, metaSummary)`. */
  description: string;
  /** Initial view encoded as a URL hash (`#x=…&y=…&z=…&i=…&c=…&aa=…`). */
  initialHash: string;
}

interface PresetSeed {
  slug: string;
  name: string;
  centerX: number;
  centerY: number;
  zoom: number;
  colorScheme: ColorScheme;
  maxIter: number;
  shortSummary: string;
  metaSummary: string;
  body: string;
}

/**
 * Build the `#x=…&y=…&z=…&i=…&c=…&aa=…` initial-view hash. Mirrors the
 * format produced by `serializeToHash` in `url-state.ts` so visitors arrive
 * at the explorer with the correct view applied. Kept inline (not imported
 * from `url-state.ts`) so this module remains worker- and Astro-safe with
 * no dependency on `bigfloat-esnext` or `compute.ts`.
 */
function buildInitialHash(seed: PresetSeed): string {
  const params = new URLSearchParams();
  params.set("x", seed.centerX.toPrecision(15));
  params.set("y", seed.centerY.toPrecision(15));
  params.set("z", seed.zoom.toPrecision(10));
  params.set("i", String(seed.maxIter));
  params.set("c", seed.colorScheme);
  params.set("aa", "auto");
  return "#" + params.toString();
}

const SEEDS: readonly PresetSeed[] = [
  {
    slug: "seahorse-valley",
    name: "Seahorse Valley",
    centerX: -0.746759001575747,
    centerY: 0.0960456531166771,
    zoom: 0.007697371773,
    colorScheme: "ocean",
    maxIter: 800,
    shortSummary:
      "the famous spiral-filled gap between the main cardioid and the period-2 bulb",
    metaSummary:
      "Seahorse Valley sits between the main cardioid and the period-2 bulb of the Mandelbrot set, around c ≈ −0.75 + 0.1i. Zooming in reveals endless seahorse-tail spirals and miniature copies of the whole set.",
    body: "Seahorse Valley is one of the most-visited regions of the Mandelbrot set. It lies between the main cardioid and the period-2 bulb, centered around the complex number c ≈ −0.75 + 0.1i. As you zoom toward the boundary, the valley produces a near-endless cascade of double spirals shaped like seahorse tails — each containing smaller seahorses inside, all the way down. Halfway down most paths you will hit a minibrot: a perfect miniature copy of the entire Mandelbrot set, complete with its own cardioid, bulbs, and valleys. Mandelbro renders Seahorse Valley with the ocean palette by default. Pinch to zoom in, drag to pan, and copy the URL at any depth to share the exact view.",
  },
  {
    slug: "elephant-valley",
    name: "Elephant Valley",
    centerX: 0.279314988638172,
    centerY: 0.00939674211801463,
    zoom: 0.003949968815,
    colorScheme: "fire",
    maxIter: 800,
    shortSummary:
      "trunk-and-tusk spirals along the right edge of the main cardioid",
    metaSummary:
      "Elephant Valley sits along the right edge of the main cardioid of the Mandelbrot set, around c ≈ 0.27 + 0.006i. Zooming in reveals trunk-and-tusk spirals that look like a parade of elephants.",
    body: "Elephant Valley runs along the eastern boundary of the Mandelbrot set's main cardioid, near c ≈ 0.27 + 0.006i. Where Seahorse Valley produces tightly wound double spirals, Elephant Valley produces broader curls that — at the right zoom — really do look like a procession of cartoon elephants, complete with trunks and tusks. The valley is also a great place to find period-doubling bifurcations: bulbs branching off the main cardioid, each with its own family of decorations. Mandelbro opens this view with the fire palette and a higher iteration count to keep boundary detail crisp as you zoom.",
  },
  {
    slug: "lightning-bolt",
    name: "Lightning Bolt",
    centerX: -1.315180982097868,
    centerY: 0.07352926355990851,
    zoom: 0.0003,
    colorScheme: "neon",
    maxIter: 1200,
    shortSummary:
      "jagged dendrite filaments that branch like static electricity",
    metaSummary:
      "The Lightning Bolt region of the Mandelbrot set, near c ≈ −1.315 + 0.074i, contains dendritic filaments that branch like bolts of static electricity into the complex plane.",
    body: "Out near c ≈ −1.315 + 0.074i, the Mandelbrot set thins into a delicate lattice of dendrites — narrow filaments that branch and re-branch like bolts of static electricity. These structures form along the boundaries of period-doubling cascades, where the set itself is no longer a connected blob but a Cantor-like web of fine threads. The neon palette in Mandelbro is tuned for this kind of high-contrast filament work, with vivid color cycling that makes each branch jump off the dark background. Try zooming a few orders of magnitude in: you will find that every bolt eventually terminates in another, smaller minibrot.",
  },
  {
    slug: "double-spiral",
    name: "Double Spiral",
    centerX: -0.0452394340153082,
    centerY: 0.986796283427352,
    zoom: 0.00003,
    colorScheme: "psychedelic",
    maxIter: 1500,
    shortSummary:
      "interlocked spirals near the upper antenna — peak psychedelic territory",
    metaSummary:
      "The Double Spiral location of the Mandelbrot set, near c ≈ −0.045 + 0.987i, is two interlocking spirals along the upper antenna — the most popular destination for psychedelic fractal art.",
    body: "Up near c ≈ −0.045 + 0.987i, along the Mandelbrot set's vertical antenna, two opposing spirals lock together into one of the most photogenic patterns the set produces. Because the spirals are tightly nested and balanced, deep zooming here yields beautifully symmetric kaleidoscope-style imagery — exactly the kind of fractal art that ends up on album covers and trippy visualizers. Mandelbro pairs this view with the psychedelic palette: a high-saturation rainbow that maps escape iterations to a continuously cycling hue, so subtle iteration changes become bold color bands. Open the settings panel to swap palettes if you want a moodier or more minimal look.",
  },
  {
    slug: "mini-mandelbrot",
    name: "Mini Mandelbrot",
    centerX: -1.749,
    centerY: 0,
    zoom: 0.05,
    colorScheme: "classic",
    maxIter: 600,
    shortSummary:
      "a miniature copy of the entire Mandelbrot set hidden along the real axis",
    metaSummary:
      "A Mini Mandelbrot — also called a minibrot — is a miniature copy of the entire Mandelbrot set that appears at countless zoom depths. This one sits at c ≈ −1.749 along the real axis.",
    body: "One of the strangest properties of the Mandelbrot set is that it is full of perfect miniature copies of itself, called minibrots. They are not approximate — every minibrot is a topologically faithful copy with its own cardioid, period-2 bulb, antennas, and an entire family of even smaller minibrots inside. This particular minibrot sits along the real axis near c ≈ −1.749, in the period-3 region of the set. It is one of the easiest to find: you only need a modest zoom to see it clearly. Once you do, try zooming into its boundary — you will discover that the same Seahorse and Elephant valleys appear at this scale too, and at every scale below.",
  },
  {
    slug: "starfish",
    name: "Starfish",
    centerX: -0.3742,
    centerY: 0.6598,
    zoom: 0.02,
    colorScheme: "rainbow",
    maxIter: 600,
    shortSummary: "five-armed radial structures with rainbow color cycling",
    metaSummary:
      "The Starfish region of the Mandelbrot set, near c ≈ −0.374 + 0.660i, produces beautifully symmetric five-armed radial structures rendered with a rainbow palette.",
    body: "Near c ≈ −0.374 + 0.660i, on a period-5 bulb attached to the main cardioid, the Mandelbrot set produces a parade of five-armed radial decorations that look like starfish suspended in deep water. The five-fold symmetry is mathematical: every period-n bulb generates n-armed antennas and n-fold symmetric decorations as you zoom in. Mandelbro opens this view with the rainbow palette to play up the radial structure — each arm cycles through a clean spectrum that makes the symmetry obvious. Zoom in further and the arms split into smaller five-pointed copies, all the way down to the next minibrot.",
  },
  {
    slug: "jewel",
    name: "Jewel",
    centerX: -0.235125,
    centerY: 0.827215,
    zoom: 0.00004,
    colorScheme: "ice",
    maxIter: 1500,
    shortSummary:
      "a tightly faceted gem-like cluster on the upper boundary, rendered in ice",
    metaSummary:
      "The Jewel location of the Mandelbrot set, near c ≈ −0.235 + 0.827i, is a tightly faceted gem-like cluster — pin-sharp boundary detail rendered with the ice palette.",
    body: "The Jewel is a deep-zoom location on the upper boundary of the Mandelbrot set, near c ≈ −0.235 + 0.827i, where the iteration count climbs sharply and the boundary fractures into thousands of crystalline facets. At this zoom level (≈ 4 × 10⁻⁵ across), the structure looks more like a cut diamond than a fractal: tight clusters of dendrites surrounding a central minibrot, each refracting iteration counts into long color gradients. Mandelbro pairs this view with the ice palette and a high iteration count so the boundary stays crisp under deep magnification. Push the zoom another few orders of magnitude in and the perturbation pipeline takes over automatically.",
  },
];

export const PRESET_LANDING_PAGES: readonly PresetLandingPage[] = SEEDS.map(
  (seed) => ({
    slug: seed.slug,
    path: `/${seed.slug}`,
    name: seed.name,
    centerX: seed.centerX,
    centerY: seed.centerY,
    zoom: seed.zoom,
    colorScheme: seed.colorScheme,
    maxIter: seed.maxIter,
    shortSummary: seed.shortSummary,
    metaSummary: seed.metaSummary,
    body: seed.body,
    title: locationPageTitle(seed.name),
    description: locationPageDescription(seed.name, seed.metaSummary),
    initialHash: buildInitialHash(seed),
  }),
);
