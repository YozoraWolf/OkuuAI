import { defineConfig } from 'vite'
import { fileURLToPath, URL } from "url";
import vue from '@vitejs/plugin-vue'
import postcssNesting from 'postcss-nesting';
import postcssPresetEnv from 'postcss-preset-env';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import env from './env.json';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: '../gui',
    emptyOutDir: true,
  },
  server: {
    port: Number(env.gui_port),
  },
  plugins: [vue()],
  css: {
    postcss: {
      plugins: [
        postcssNesting,
        postcssPresetEnv,
        autoprefixer,
        cssnano,
      ],
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./', import.meta.url)) },
    ],
  },
})
