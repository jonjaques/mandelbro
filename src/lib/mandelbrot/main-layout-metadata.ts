/**
 * HTML shell + JSON-LD copy for `src/layouts/main.astro`.
 * Layout-only: keeps large SEO blobs off worker/client bundles that import `constants.ts`.
 */

import { BRAND_NAME } from "@/lib/mandelbrot/constants";
import {
  MIT_LICENSE_URL,
  SOURCE_CODE_URL,
  WIKIPEDIA_COMPLEX_DYNAMICS_URL,
  WIKIPEDIA_FRACTAL_URL,
  WIKIPEDIA_MANDELBROT_SET_URL,
} from "@/lib/site-config";

export const HTML_DOCUMENT_LANG = "en";

/** Matches `viewport-fit=cover`, no user zoom (per PWA immersion). */
export const META_VIEWPORT =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

export const META_THEME_COLOR = "#000000";

export const META_ROBOTS_NOINDEX = "noindex, nofollow";

export const MOBILE_WEB_APP_CAPABLE = "yes";

export const APPLE_MOBILE_WEB_APP_CAPABLE = "yes";

export const APPLE_STATUS_BAR_STYLE = "black-translucent";

export const DEFAULT_PREVIEW_IMAGE_PATH = "/preview.jpg";

export const ASSET_ICON_SVG_PATH = "/favicon.svg";

export const ASSET_WEB_MANIFEST_PATH = "/manifest.webmanifest";

/** Rel="apple-touch-icon" entries (`sizes` omitted when absent). */
export const APPLE_TOUCH_ICONS = [
  { href: "/appicon.png" as const },
  { href: "/appicon-180.png" as const, sizes: "180x180" as const },
  { href: "/appicon-192.png" as const, sizes: "192x192" as const },
  { href: "/appicon-512.png" as const, sizes: "512x512" as const },
] as const;

export const FONT_PRECONNECT_GOOGLE = "https://fonts.googleapis.com";

export const FONT_PRECONNECT_GSTATIC = "https://fonts.gstatic.com";

export const FONT_STYLESHEET_GOOGLE =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

export const FONT_STYLESHEET_MACULA = "https://fonts.cdnfonts.com/css/macula";

export const ANALYTICS_GTAG_LOADER_BASE =
  "https://www.googletagmanager.com/gtag/js";

export function analyticsInlineSnippet(gaKey: string): string {
  return [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments)}",
    "gtag('js', new Date());",
    `gtag('config', '${gaKey}');`,
  ].join("");
}

export const OG_TYPE_WEBSITE = "website";

export const OG_LOCALE = "en_US";

export const OG_SOCIAL_CARD_IMAGE_ALT = `${BRAND_NAME} — an interactive Mandelbrot set fractal explorer with deep zoom`;

export const OG_IMAGE_WIDTH = "1200";

export const OG_IMAGE_HEIGHT = "630";

export const OG_IMAGE_MIME_JPEG = "image/jpeg";

export const TWITTER_CARD_LARGE_IMAGE = "summary_large_image";

export const SCHEMA_CONTEXT = "https://schema.org";

export const SITE_APPLICATION_CATEGORY = "EducationalApplication";

export const SITE_APPLICATION_SUBCATEGORY = "Mathematics Visualization";

export const SITE_JSON_LD_KEYWORDS =
  "mandelbrot set, fractal, fractal explorer, fractal renderer, deep zoom, perturbation theory, browser, javascript, online, free";

export const SITE_OPERATING_SYSTEM = "Any";

export const SITE_BROWSER_REQUIREMENTS =
  "Requires a modern browser with JavaScript and Web Workers";

export const SITE_SOFTWARE_VERSION = "1.0";

export const SITE_OFFER_PRICE = "0";

export const SITE_OFFER_CURRENCY = "USD";

export const SITE_JSON_LD_LANGUAGE = "en";

export const SITE_APP_ALTERNATE_NAMES = [
  `${BRAND_NAME} Fractal Explorer`,
  "Mandelbrot Set Explorer",
  "Mandelbrot Renderer",
] as const;

export const SITE_WEB_APP_FEATURE_LIST = [
  "Arbitrary-precision deep zoom past 10^50× magnification",
  "Perturbation theory rendering with series approximation",
  "Multi-threaded Web Worker parallel rendering",
  "7 smooth-gradient color palettes",
  "Shareable deep-zoom URLs",
  "Installable progressive web app with offline support",
  "Touch-native with pinch-to-zoom and drag-to-pan",
  "Cardioid and period-2 bulb optimization",
  "Brent cycle detection for interior orbits",
  "Fullscreen immersive interface",
] as const;

/** FAQPage Question / Answer texts (shared with structured data only). */
export const SITE_STRUCTURED_DATA_FAQ = [
  {
    question: "What is the Mandelbrot set?",
    answer:
      "The Mandelbrot set is the set of complex numbers c for which the iteration z → z² + c (starting at z = 0) stays bounded forever. Discovered by Benoît Mandelbrot in 1980, its boundary is a fractal of infinite detail — every zoom reveals new spirals, miniature copies of the whole set, and self-similar structure.",
  },
  {
    question: `How deep can ${BRAND_NAME} zoom into the Mandelbrot set?`,
    answer: `${BRAND_NAME} uses arbitrary-precision arithmetic with perturbation theory and series approximation to zoom past 10^50× magnification — far beyond the 10^14× limit of standard double-precision renderers. You can explore miniature Mandelbrot copies and spiral formations at extreme depths, all in your browser.`,
  },
  {
    question: `Is ${BRAND_NAME} free to use?`,
    answer: `Yes. ${BRAND_NAME} is completely free, open-source (MIT license), and runs entirely in your browser with no downloads, sign-ups, or server-side processing required. You can even install it as a PWA for offline use.`,
  },
  {
    question: "What is perturbation theory in Mandelbrot rendering?",
    answer:
      "Perturbation theory computes one high-precision reference orbit and then derives each pixel as a small delta from that orbit using fast double-precision math. Combined with series approximation, this makes deep zooming orders of magnitude faster than computing every pixel at full precision.",
  },
  {
    question: "Can I share a specific Mandelbrot location?",
    answer: `Yes. ${BRAND_NAME} encodes the exact view coordinates and zoom level in the URL hash. Copy the URL to share any location — the recipient sees exactly what you see, even at extreme zoom depths.`,
  },
  {
    question: "What are Seahorse Valley and Elephant Valley?",
    answer: `Seahorse Valley (around c ≈ −0.75 + 0.1i) and Elephant Valley (around c ≈ 0.27 + 0.006i) are two of the most famous regions of the Mandelbrot set. The valleys sit between the main cardioid and the period-2 bulb and contain endless seahorse-like or trunk-and-tusk spirals. ${BRAND_NAME} ships both as preset locations.`,
  },
  {
    question: `Is ${BRAND_NAME} a good fractal renderer for mobile?`,
    answer: `Yes. ${BRAND_NAME} is a touch-native progressive web app: pinch to zoom, drag to pan, double-tap to zoom in. It runs without an app-store install and works offline once cached.`,
  },
] as const;

const SITE_JSON_LD_ABOUT_THINGS = [
  { name: "Mandelbrot set", sameAs: WIKIPEDIA_MANDELBROT_SET_URL },
  { name: "Fractal", sameAs: WIKIPEDIA_FRACTAL_URL },
  { name: "Complex dynamics", sameAs: WIKIPEDIA_COMPLEX_DYNAMICS_URL },
] as const;

export function mainLayoutStructuredData(payload: {
  canonicalUrl: string;
  description: string;
  imageUrl: string;
  authorEntity: {
    "@type": "Person";
    name: string;
    url: string;
  };
}): unknown[] {
  const { canonicalUrl, description, imageUrl, authorEntity } = payload;

  return [
    {
      "@context": SCHEMA_CONTEXT,
      "@type": "WebApplication",
      name: BRAND_NAME,
      alternateName: [...SITE_APP_ALTERNATE_NAMES],
      url: canonicalUrl,
      sameAs: [SOURCE_CODE_URL],
      description,
      applicationCategory: SITE_APPLICATION_CATEGORY,
      applicationSubCategory: SITE_APPLICATION_SUBCATEGORY,
      keywords: SITE_JSON_LD_KEYWORDS,
      operatingSystem: SITE_OPERATING_SYSTEM,
      browserRequirements: SITE_BROWSER_REQUIREMENTS,
      softwareVersion: SITE_SOFTWARE_VERSION,
      image: imageUrl,
      screenshot: imageUrl,
      offers: {
        "@type": "Offer",
        price: SITE_OFFER_PRICE,
        priceCurrency: SITE_OFFER_CURRENCY,
      },
      featureList: [...SITE_WEB_APP_FEATURE_LIST],
      author: authorEntity,
      creator: authorEntity,
      sourceOrganization: authorEntity,
      isAccessibleForFree: true,
      license: MIT_LICENSE_URL,
      inLanguage: SITE_JSON_LD_LANGUAGE,
      about: SITE_JSON_LD_ABOUT_THINGS.map((t) => ({
        "@type": "Thing",
        name: t.name,
        sameAs: t.sameAs,
      })),
    },
    {
      "@context": SCHEMA_CONTEXT,
      "@type": "FAQPage",
      mainEntity: SITE_STRUCTURED_DATA_FAQ.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];
}
