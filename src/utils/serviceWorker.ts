// Service Worker registration and management

interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  onOffline?: () => void
  onOnline?: () => void
}

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
)

export function registerSW(config?: ServiceWorkerConfig) {
  if ('serviceWorker' in navigator) {
    const publicUrl = new URL(import.meta.env.BASE_URL || '/', window.location.href)
    if (publicUrl.origin !== window.location.origin) {
      return
    }

    window.addEventListener('load', () => {
      const swUrl = `${import.meta.env.BASE_URL || '/'}sw.js`

      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config)
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service worker.'
          )
        })
      } else {
        registerValidSW(swUrl, config)
      }
    })

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('App is online')
      config?.onOnline?.()
    })

    window.addEventListener('offline', () => {
      console.log('App is offline')
      config?.onOffline?.()
    })
  }
}

function registerValidSW(swUrl: string, config?: ServiceWorkerConfig) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker == null) {
          return
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log(
                'New content is available and will be used when all tabs for this page are closed.'
              )
              config?.onUpdate?.(registration)
            } else {
              console.log('Content is cached for offline use.')
              config?.onSuccess?.(registration)
            }
          }
        }
      }
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error)
    })
}

function checkValidServiceWorker(swUrl: string, config?: ServiceWorkerConfig) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type')
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload()
          })
        })
      } else {
        registerValidSW(swUrl, config)
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.')
    })
}

export function unregisterSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister()
      })
      .catch((error) => {
        console.error(error.message)
      })
  }
}

// Utility functions for service worker communication
export function skipWaiting() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
  }
}

export function clearCache() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
  }
}

// Check if app is running in standalone mode (PWA)
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

interface NetworkConnection {
  effectiveType?: string
  downlink?: number
  rtt?: number
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnection
  mozConnection?: NetworkConnection
  webkitConnection?: NetworkConnection
}

// Get network status
export function getNetworkStatus() {
  const nav = navigator as NavigatorWithConnection
  return {
    online: navigator.onLine,
    connection: nav.connection || nav.mozConnection || nav.webkitConnection,
    effectiveType: (nav.connection || {}).effectiveType || 'unknown'
  }
}

// Service worker update notification hook
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = React.useState(false)
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)

  React.useEffect(() => {
    registerSW({
      onUpdate: (reg) => {
        setUpdateAvailable(true)
        setRegistration(reg)
      },
      onSuccess: (reg) => {
        console.log('Service worker registered successfully')
        setRegistration(reg)
      }
    })
  }, [])

  const applyUpdate = React.useCallback(() => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }, [registration])

  return {
    updateAvailable,
    applyUpdate,
    registration
  }
}

// React import for the hook
import React from 'react'