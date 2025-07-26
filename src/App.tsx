import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { Toaster } from 'sonner'
import { Suspense, lazy } from 'react'
import { config } from './lib/wagmi'
import { PlatformShell } from './components/PlatformShell'
import { StarfieldBackground } from './components/StarfieldBackground'
import ErrorBoundary from './components/ErrorBoundary'
import { WalletNotifications } from './components/WalletNotifications'
import PerformanceDashboard from './components/PerformanceDashboard'
import '@rainbow-me/rainbowkit/styles.css'

// Lazy load page components for code splitting
const Lobby = lazy(() => import('./pages/Lobby').then(module => ({ default: module.Lobby })))
const GameHost = lazy(() => import('./pages/GameHost').then(module => ({ default: module.GameHost })))
const Fountain = lazy(() => import('./pages/Fountain'))

// Loading component for suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
  </div>
)

const queryClient = new QueryClient()

function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <WalletNotifications />
            <Router>
              <div className="min-h-screen bg-primary text-white relative overflow-hidden">
                <StarfieldBackground />
                <PlatformShell>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Lobby />} />
                      <Route path="/game/:gameId" element={<GameHost />} />
                      <Route path="/fountain" element={<Fountain />} />
                    </Routes>
                  </Suspense>
                </PlatformShell>
                <PerformanceDashboard />
                <Toaster 
                  theme="dark" 
                  position="top-right"
                  expand={true}
                  richColors={true}
                  closeButton={true}
                  toastOptions={{
                    style: {
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontFamily: 'Inter, sans-serif',
                    },
                    className: 'font-body',
                  }}
                />
              </div>
            </Router>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  )
}

export default App
