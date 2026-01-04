import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [svelte(), mdx()],
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
        // Resolve devtools mount subpath (workspace packages may not respect exports field)
        'batchkit-devtools/mount': resolve(
          __dirname,
          '../../packages/devtools/dist/mount.js',
        ),
      },
    },
    optimizeDeps: {
      exclude: ['batchkit'],
    },
  },
});
