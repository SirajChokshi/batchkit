import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [svelte()],
  vite: {
    resolve: {
      alias: {
        // Resolve batchkit to the source files directly
        'batchkit': resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['batchkit'],
    },
  },
});

