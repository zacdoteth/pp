import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 6969, open: true },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    reportCompressedSize: true,
    cssMinify: true,
  },
})
