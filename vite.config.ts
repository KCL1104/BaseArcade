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
        manualChunks: {
          // Keep only essential vendor chunks to avoid circular dependencies
          'react-vendor': ['react', 'react-dom'],
          'web3-vendor': ['wagmi', 'viem', '@rainbow-me/rainbowkit'],
          'socket-vendor': ['socket.io-client']
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
      '@tanstack/react-query',
      'socket.io-client',
      'sonner',
      'canvas-confetti'
    ]
  }
})
