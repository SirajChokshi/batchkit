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
      entry: './src/index.ts',
      formats: ['es'],
      fileName: 'index',
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
