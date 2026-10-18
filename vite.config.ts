import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
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
  build: {
    rolldownOptions: {
      output: {
        // Bibliothèques dans leurs propres fichiers : elles changent rarement, le navigateur les garde en cache
        // d'un déploiement à l'autre (les pages, elles, sont découpées par route dans App.tsx).
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // Copies de travail des agents Claude Code (.claude/worktrees) : leurs tests ne sont pas ceux du dépôt.
    exclude: [...configDefaults.exclude, '.claude/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // jsdom ne sert qu'aux tests de composants (.tsx) : le créer pour chaque fichier de calcul pur coûtait
    // l'essentiel de la durée des tests ; vmThreads le garde d'un fichier à l'autre (isolation conservée).
    projects: [
      { extends: true, test: { name: 'unit', environment: 'node', include: ['tests/**/*.test.ts'] } },
      { extends: true, test: { name: 'dom', environment: 'jsdom', pool: 'vmThreads', include: ['tests/**/*.test.tsx'] } },
    ],
  },
})
