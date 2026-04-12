import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// Cloudflare Pages sets CF_PAGES_URL at build time (e.g.
// "https://branchname.mandelbro.pages.dev"). Use it for preview deployments
// so canonical URLs, OG tags, and sitemaps match the deployment. Falls back
// to the production custom domain for local dev and production builds.
const site = process.env.CF_PAGES_URL ?? "https://mandelbro.jonjaques.com";

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
