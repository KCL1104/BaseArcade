import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from './utils/serviceWorker'

// Register service worker for caching and offline support
if (import.meta.env.PROD) {
  registerSW({
    onSuccess: () => {
      console.log('App is ready for offline use')
    },
    onUpdate: () => {
      console.log('New app version available')
    },
    onOffline: () => {
      console.log('App is running in offline mode')
    },
    onOnline: () => {
      console.log('App is back online')
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
