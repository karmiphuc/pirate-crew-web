import { defineConfig } from "vite";
export default defineConfig({
  // Portable static SPA: works at /, a Pages repository path, or a custom domain.
  base: "./",
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
  },
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
});
