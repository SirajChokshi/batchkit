import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [svelte()],
  redirects: {
    '/docs': '/docs/guide',
  },
  markdown: {
    shikiConfig: {
      theme: 'vitesse-dark',
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Resolve batchkit to the source files directly
        batchkit: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['batchkit'],
    },
  },
});
