import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    // Code splitting optimization
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            if (id.includes('framer-motion')) {
              return 'animation-vendor'
            }
            if (id.includes('wagmi') || id.includes('rainbow') || id.includes('viem')) {
              return 'web3-vendor'
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor'
            }
            return 'vendor'
          }
          
          // Component chunks
          if (id.includes('/components/')) {
            return 'components'
          }
          if (id.includes('/pages/')) {
            return 'pages'
          }
          if (id.includes('/services/')) {
            return 'services'
          }
        },
        // Optimize chunk file names for better caching
        chunkFileNames: () => {
          return 'assets/[name]-[hash].js'
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Build optimizations
    target: 'esnext',
    minify: 'terser',
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Source maps for production debugging
    sourcemap: false
  },
  // Development optimizations
  server: {
    hmr: {
      overlay: false
    }
  },
  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      'wagmi',
      'viem',
      '@rainbow-me/rainbowkit',
      'zustand',
      '@tanstack/react-query'
    ]
  }
})
