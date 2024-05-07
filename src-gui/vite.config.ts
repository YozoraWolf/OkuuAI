import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import postcssNesting from 'postcss-nesting';
import dotenv from 'dotenv';

dotenv.config();

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: '../gui',
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.FRONT_PORT),
  },
  plugins: [vue()],
  css: {
    postcss: {
      plugins: [
        postcssNesting
      ],
    },
  },
})
