import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    solid({
      solid: {
        generate: 'dom',
        hydratable: false,
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        index: './src/index.ts',
        mount: './src/mount.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['batchkit', 'solid-js', 'solid-js/web'],
    },
    cssMinify: true,
  },
  css: {
    modules: {
      generateScopedName: 'bk-[local]',
    },
  },
});
