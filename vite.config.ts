import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? ''),
    },
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png', 'panda-192.png', 'panda-512.png', 'panda-512-maskable.png'],
        manifest: {
          id: '/',
          name: 'Panda.fun - Anime & Movie Streaming',
          short_name: 'Panda.fun',
          description: 'Anime, movies and series on Panda.fun with a modern, cinematic streaming experience.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          orientation: 'any',
          categories: ['entertainment', 'video'],
          icons: [
            { src: '/panda-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/panda-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/panda-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => ['image', 'font'].includes(request.destination),
              handler: 'CacheFirst',
              options: {
                cacheName: 'panda-static-media-v1',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'panda-api-v1',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
        strategies: 'generateSW',
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
