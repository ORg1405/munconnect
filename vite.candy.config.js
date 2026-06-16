import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Config de build dedicado ao site Doce Mel (balas artesanais).
// Totalmente separado do MUNConnect — não usa o vite.config.js principal.
// Dev:   npx vite --config vite.candy.config.js   ->  http://localhost:5174/candy.html
// Build: npx vite build --config vite.candy.config.js  ->  dist-candy/
export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o site funciona tanto na raiz quanto em subpasta
  // (ex.: GitHub Pages em /munconnect/candy.html).
  base: "./",
  server: { host: true, port: 5174, open: "/candy.html" },
  build: {
    outDir: "dist-candy",
    rollupOptions: {
      input: resolve(process.cwd(), "candy.html"),
    },
  },
});
