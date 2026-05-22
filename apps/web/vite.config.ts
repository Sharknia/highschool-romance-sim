import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveWebDevServerConfig } from "./scripts/dev-server-config.mjs";

const devServerConfig = resolveWebDevServerConfig(process.env);

export default defineConfig({
  root: ".",
  plugins: [react()],
  define: {
    "globalThis.__VN_MAKER_ALPHA_SANDBOX__": JSON.stringify(process.env.VN_MAKER_ALPHA_SANDBOX === "1")
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": devServerConfig.apiTarget,
      "/generated-assets": devServerConfig.apiTarget
    }
  }
});
