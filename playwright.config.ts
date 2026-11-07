import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: { command: "npx vite preview --port 4173 --host 127.0.0.1 --strictPort", url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "tv-1920", use: { viewport: { width: 1920, height: 1080 } }, metadata: { tv: true } },
    { name: "tv-1280", use: { viewport: { width: 1280, height: 720 } }, metadata: { tv: true } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "mobile-360", use: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } },
    { name: "tablet-820", use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
  ],
});
