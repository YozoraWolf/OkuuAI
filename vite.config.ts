import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  root: 'src-gui',
  build: {
    outDir: '../gui',
    emptyOutDir: true,
  },
  server: {
    port: 8009,
  },
  plugins: [vue()],
})
