import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['trave.svg', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TraveXperience',
        short_name: 'TraveXperience',
        description: 'Descubre lugares turísticos, hoteles y arma tu itinerario en la Sierra Norte de Puebla.',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: '#F4B400',
        categories: ['travel', 'navigation', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Solo el "shell" de la app. Las imágenes grandes de /public (2 MB+) NO se
        // precargan; se cachean bajo demanda en runtimeCaching.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Teselas del mapa (CARTO, Esri, OpenStreetMap): se guardan para ver el mapa sin conexión
          {
            urlPattern: /^https:\/\/((?:[a-c]\.)?tile\.openstreetmap\.org|server\.arcgisonline\.com)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Lugares turísticos / hoteles / categorías del backend (solo lectura, GET)
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.origin !== self.location.origin &&
              /\/(local\/(nearby|categories)|hotels\/nearby)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'places-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Condiciones meteorológicas: tolera conexiones intermitentes y conserva una lectura reciente.
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/weather$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-current',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/weather\/forecast$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-forecast',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Avisos viales/naturales: caché breve; en offline la interfaz advierte que pueden estar desactualizados.
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/risks\/nearby$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'risk-alerts',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 15 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Lugares turísticos de OpenStreetMap (Overpass)
          {
            urlPattern: /^https:\/\/overpass[^/]*\.(de|fr|private\.coffee|kumi\.systems|api\.openstreetmap\.fr)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osm-pois',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fotos de lugares/hoteles (proxy del backend, Cloudinary, Unsplash, etc.)
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fuentes de Google Fonts (CSS y archivos)
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // CSS/ícono de Leaflet desde unpkg
          {
            urlPattern: /^https:\/\/unpkg\.com\/leaflet@.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'leaflet-assets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
