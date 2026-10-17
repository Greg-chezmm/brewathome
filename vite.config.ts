/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/brewathome/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: '/brewathome/',
        name: 'BrewAtHome',
        lang: 'fr',
        short_name: 'BrewAtHome',
        description: 'Préparation de recettes, suivi de brassage et de fermentation pour le brassage amateur.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/brewathome/',
        scope: '/brewathome/',
        // Appui long sur l'icône de l'app installée (Android, Windows) : accès direct.
        shortcuts: [
          { name: 'Brassins', url: '/brewathome/batches', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Recettes', url: '/brewathome/recipes', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Outils', url: '/brewathome/tools', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
