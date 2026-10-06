import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Servido em produção sob /campo/ (mesmo domínio do Manutip, nginx do
// sistema repassa essa rota pro container deste app) — base precisa bater
// com isso também em dev, senão os caminhos dos assets quebram.
export default defineConfig({
  base: "/campo/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // /api/* nunca é cacheado pelo service worker — a fila offline
      // (src/offline/fila.js) é quem decide o que fazer quando a rede
      // falha, o SW só cuida da casca do app (HTML/JS/CSS/ícones).
      workbox: {
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Manutip Campo",
        short_name: "Manutip Campo",
        description: "App de campo para equipes do Manutip",
        start_url: "/campo/",
        scope: "/campo/",
        display: "standalone",
        background_color: "#f4f6fa",
        theme_color: "#3b82f6",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:8010",
    },
  },
});
