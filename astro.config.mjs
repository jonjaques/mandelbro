import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// Cloudflare Pages sets CF_PAGES_BRANCH and CF_PAGES_URL at build time.
// On non-main branches, use CF_PAGES_URL so canonical URLs, OG tags, and
// sitemaps match the preview deployment. On main (and local dev), always
// use the production custom domain — CF_PAGES_URL would be the *.pages.dev
// deploy hash URL, not the vanity domain.
const isPreview =
  process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== "main";
const site = isPreview
  ? process.env.CF_PAGES_URL
  : "https://mandelbro.jonjaques.com";

// https://astro.build/config
export default defineConfig({
  site,
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    sitemap(),
  ],
});
