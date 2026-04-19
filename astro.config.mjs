// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";

import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  experimental: {
    csp: true,
  },
  site: "https://robertshalders.com",
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap(), icon()],
});
