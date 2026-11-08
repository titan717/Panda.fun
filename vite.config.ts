import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import fontScale from "./scripts/postcss-font-scale.mjs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig(({ mode }) => ({
  // The Android WebView loads the bundle from appassets.androidplatform.net/assets/web/, so it needs relative URLs.
  base: mode === "android" ? "./" : "/",
  plugins: [react()],
  css: { postcss: { plugins: [fontScale()] } },
  // Preact's compat layer replaces react-dom in production builds (~41 KB gzip less on first load). Tests keep real React. See DECISIONS D-37.
  resolve: mode === "test" ? {} : {
    alias: { "react-dom/test-utils": "preact/test-utils", "react-dom/client": "preact/compat/client", "react-dom": "preact/compat", "react/jsx-runtime": "preact/jsx-runtime", "react/jsx-dev-runtime": "preact/jsx-dev-runtime", react: "preact/compat" }
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TARGET__: JSON.stringify(mode === "android" ? "android" : "web")
  },
  build: {
    target: "es2019",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 400,
    rollupOptions: { output: { manualChunks: { react: ["preact", "preact/compat", "preact/hooks"], vendor: ["swr", "wouter", "@bbc/tv-lrud-spatial"] } } }
  },
  server: { port: 5173, host: true },
  test: { environment: "happy-dom", include: ["src/**/*.test.{ts,tsx}"], globals: false, css: { include: [/styles\/(tokens|tv)\.css/] } }
}));
