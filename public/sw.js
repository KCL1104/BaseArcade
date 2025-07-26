// Service Worker for BaseArcade
// Provides caching for static assets and API responses

const CACHE_NAME = 'basearcade-v1'
const STATIC_CACHE = 'basearcade-static-v1'
const API_CACHE = 'basearcade-api-v1'
const IMAGE_CACHE = 'basearcade-images-v1'

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  // Add other static assets as needed
]

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/games',
  '/api/leaderboard',
  '/api/user/profile'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS)
      }),
      caches.open(API_CACHE),
      caches.open(IMAGE_CACHE)
    ])
  )
  
  // Force the waiting service worker to become the active service worker
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE && 
              cacheName !== IMAGE_CACHE) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  
  // Claim all clients immediately
  self.clients.claim()
})

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request))
  } else if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request))
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
  } else {
    event.respondWith(handleOtherRequest(request))
  }
})

// Check if request is for static asset
function isStaticAsset(url) {
  return url.pathname.match(/\.(js|css|html|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)
}

// Check if request is for API
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || 
         API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))
}

// Check if request is for image
function isImageRequest(url) {
  return url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|avif)$/)
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('Error handling static asset:', error)
    return new Response('Asset not available', { status: 404 })
  }
}

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  try {
    const cache = await caches.open(API_CACHE)
    
    // Try network first
    try {
      const networkResponse = await fetch(request)
      
      if (networkResponse.ok) {
        // Cache successful responses for 5 minutes
        const responseToCache = networkResponse.clone()
        const headers = new Headers(responseToCache.headers)
        headers.set('sw-cache-timestamp', Date.now().toString())
        
        const modifiedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        })
        
        cache.put(request, modifiedResponse)
      }
      
      return networkResponse
    } catch (networkError) {
      // Network failed, try cache
      const cachedResponse = await cache.match(request)
      
      if (cachedResponse) {
        // Check if cache is still valid (5 minutes)
        const cacheTimestamp = cachedResponse.headers.get('sw-cache-timestamp')
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000
        
        if (cacheTimestamp && (now - parseInt(cacheTimestamp)) < fiveMinutes) {
          return cachedResponse
        }
      }
      
      throw networkError
    }
  } catch (error) {
    console.error('Error handling API request:', error)
    return new Response(JSON.stringify({ error: 'Service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Handle images with cache-first strategy and longer TTL
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('Error handling image request:', error)
    return new Response('Image not available', { status: 404 })
  }
}

// Handle other requests with network-only strategy
async function handleOtherRequest(request) {
  try {
    return await fetch(request)
  } catch (error) {
    console.error('Error handling request:', error)
    return new Response('Request failed', { status: 500 })
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Handle any queued actions when back online
  console.log('Background sync triggered')
}

// Push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data.data || {}
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  )
})

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches())
  }
})

async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  )
  console.log('All caches cleared')
}