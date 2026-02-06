import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        scenery: resolve(__dirname, 'src/scenery.ts'),
      },
      formats: ['es'],
    },
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        scenery: resolve(__dirname, 'src/scenery.ts'),
        styles: resolve(__dirname, 'styles/scenery.scss'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          // Preserve original filename for CSS
          if (assetInfo.name?.endsWith('.css')) {
            return '[name][extname]';
          }
          return '[name].[hash][extname]';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    devSourcemap: true,
  },
});
