import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/meoini/",
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
        // PWA 启动画面配色：静态构建值，需与 src/styles/themes.css 的浅色主题保持一致
        theme_color: "#5b3fa8",
        background_color: "#f7f6fb",
        display: "standalone",
        start_url: "/meoini/",
        scope: "/meoini/",
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
            // Cache dictionary JSON only. Pronunciation media is streamed but is
            // not stored offline until its redistribution/cache license is confirmed.
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
});
