import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Servido em produção sob /campo/ (mesmo domínio do Manutip, nginx do
// sistema repassa essa rota pro container deste app) — base precisa bater
// com isso também em dev, senão os caminhos dos assets quebram.
export default defineConfig({
  base: "/campo/",
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:8010",
    },
  },
});
