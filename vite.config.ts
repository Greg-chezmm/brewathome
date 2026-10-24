import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

/** Commit déployé : GITHUB_SHA en CI, sinon git en local ; vide hors dépôt. */
function buildCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

const { version } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  base: '/brewathome/',
  // Affichés dans le menu (src/lib/version.ts) pour savoir quelle version est en ligne.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
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
    // Valeurs factices : certains tests importent le vrai client Supabase (qui exige ces variables) sans jamais
    // l'appeler ; la CI n'a pas de .env.local.
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
    setupFiles: ['./src/test/setup.ts'],
    // Sous charge (suite complète en parallèle), 5 s par test ne suffisent pas toujours.
    testTimeout: 15000,
    // jsdom ne sert qu'aux tests de composants (.tsx) : le créer pour chaque fichier de calcul pur coûtait
    // l'essentiel de la durée des tests ; vmThreads le garde d'un fichier à l'autre (isolation conservée).
    projects: [
      { extends: true, test: { name: 'unit', environment: 'node', include: ['tests/**/*.test.ts'] } },
      { extends: true, test: { name: 'dom', environment: 'jsdom', pool: 'vmThreads', include: ['tests/**/*.test.tsx'] } },
    ],
  },
})
