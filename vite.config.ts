import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig(({ mode }) => ({
  // The Android WebView loads the bundle from appassets.androidplatform.net/assets/web/, so it needs relative URLs.
  base: mode === "android" ? "./" : "/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TARGET__: JSON.stringify(mode === "android" ? "android" : "web")
  },
  build: {
    target: "es2019",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 400,
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom"], vendor: ["swr", "wouter", "@bbc/tv-lrud-spatial"] } } }
  },
  server: { port: 5173, host: true },
  test: { environment: "happy-dom", include: ["src/**/*.test.{ts,tsx}"], globals: false }
}));
