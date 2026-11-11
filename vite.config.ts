import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fontScale from "./scripts/postcss-font-scale.mjs";
import integrity from "./scripts/vite-integrity.mjs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig(({ mode }) => ({
  // The Android WebView loads the bundle from appassets.androidplatform.net/assets/web/, so it needs relative URLs.
  base: mode === "android" ? "./" : "/",
  plugins: [react(), integrity()],
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
    // v1.2.6 (D-157): every engine Panda targets supports <link rel="modulepreload"> natively (Chromium/WebView 66+,
    // Firefox 115+, Safari 17+); older Safari still loads every module through its imports, only without the preload hint.
    modulePreload: { polyfill: false },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      // v1.2.9: the web build also emits the /welcome landing page (src/landing); the APK only ships the app.
      input: Object.fromEntries(
        (mode === "android" ? ["index.html"] : ["index.html", "welcome/index.html"]).map((f) => [f === "index.html" ? "main" : "welcome", fileURLToPath(new URL(`./${f}`, import.meta.url))])
      ) as Record<string, string>,
      output: { manualChunks: { react: ["preact", "preact/compat", "preact/hooks"], vendor: ["swr", "wouter", "@bbc/tv-lrud-spatial"] } } }
  },
  server: { port: 5173, host: true },
  test: { environment: "happy-dom", include: ["src/**/*.test.{ts,tsx}"], globals: false, css: { include: [/styles\/(tokens|tv|mobile)\.css/, /tv\/shell\.css/, /pages\/player\.css/] } }
}));
