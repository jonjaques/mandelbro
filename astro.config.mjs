// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [
    AstroPWA({
      includeAssets: [
        "favicon.svg",
        "appicon.png",
        "preview.jpg",
        "appicon-180.png",
        "appicon-192.png",
        "appicon-512.png",
      ],
      manifest: {
        name: "Mandelbro",
        short_name: "Mandelbro",
        description: "Mandelbrot set explorer",
        theme_color: "#000000",
        background_color: "#000000",
        display: "fullscreen",
        icons: [
          {
            src: "appicon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "appicon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
