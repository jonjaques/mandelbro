/**
 * Curated citations for algorithms used in Mandelbro (shown in Reference UI).
 * URLs are stable primary sources where possible (archive.org for Martin PDF).
 */
export interface ReferenceLink {
  label: string;
  href: string;
}

export interface ReferenceSection {
  heading: string;
  summary: string;
  links: ReferenceLink[];
}

export const REFERENCE_SECTIONS: readonly ReferenceSection[] = [
  {
    heading: "Perturbation theory",
    summary:
      "Deep zoom renders one high-precision reference orbit at c_ref, then integrates each pixel as a small double-precision delta from that orbit—far cheaper than arbitrary precision per pixel.",
    links: [
      {
        label: "K. I. Martin — Superfractalthing Maths (PDF, archived)",
        href: "https://web.archive.org/web/20140628114658/http://www.superfractalthing.co.nf/sft_maths.pdf",
      },
      {
        label:
          "Wikipedia — Plotting algorithms (perturbation & series approximation)",
        href: "https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation",
      },
      {
        label: "mathr — Deep zoom theory and practice",
        href: "https://mathr.co.uk/blog/2021-05-14_deep_zoom_theory_and_practice.html",
      },
    ],
  },
  {
    heading: "Series approximation",
    summary:
      "Coefficients along the reference orbit approximate the perturbation as a polynomial in ε = c_pixel − c_ref, skipping early iterations when |ε| is tiny.",
    links: [
      {
        label: "Same Wikipedia section (series approximation)",
        href: "https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation",
      },
    ],
  },
  {
    heading: "Interior orbits & cycle detection",
    summary:
      "When the reference point stays in the set, Brent-style cycle detection spots repetition in the orbit (checked on double-precision samples) so the BigFloat loop can stop early; the orbit is then tiled to full length for workers.",
    links: [
      {
        label: "Wikipedia — Cycle detection (Brent's algorithm)",
        href: "https://en.wikipedia.org/wiki/Cycle_detection#Brent's_algorithm",
      },
    ],
  },
  {
    heading: "Arbitrary precision & pixel scale",
    summary:
      "Below about 10⁻¹³ viewport height in the complex plane, adjacent pixels differ by less than IEEE doubles can represent; the app switches pipelines and uses BigFloat for the reference orbit with controlled truncation.",
    links: [
      {
        label: "Wikipedia — Plotting algorithms (overview)",
        href: "https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set",
      },
    ],
  },
  {
    heading: "Smooth coloring",
    summary:
      "Escape counts are turned into a continuous value using the normalized iteration formula so palette bands do not line up with integer iteration steps.",
    links: [
      {
        label: "Wikipedia — Mandelbrot set (continuous / smooth coloring)",
        href: "https://en.wikipedia.org/wiki/Mandelbrot_set#Continuous_(smooth)_coloring",
      },
    ],
  },
  {
    heading: "Standard pipeline shortcuts",
    summary:
      "At shallower zoom, the app uses direct double-precision iteration with analytical tests for the main cardioid and period-2 bulb to skip known interior regions.",
    links: [
      {
        label: "Wikipedia — Plotting algorithms (optimization)",
        href: "https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Cardioid_and_bulb_checking",
      },
    ],
  },
] as const;
