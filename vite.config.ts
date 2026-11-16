import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const base = mode === "k8s" ? "/" : "/meoini/";

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "Meoini",
          short_name: "Meoini",
          description: "查词、闪卡与间隔复习",
          theme_color: "#5b3fa8",
          background_color: "#f7f6fb",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            {
              src: "favicon.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.dictionaryapi\.dev\/api\/v2\/entries\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "dictionary-api",
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https:\/\/([a-z]+\.)?wiktionary\.org\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "wiktionary-api",
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
  };
});
