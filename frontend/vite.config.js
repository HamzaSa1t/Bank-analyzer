import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-d3'
          if (id.includes('framer-motion')) return 'vendor-motion'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
