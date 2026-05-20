import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist/client",
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5174"
    }
  }
});
