/**
 * Advanced Caching Service for Performance Optimization
 * Provides in-memory and localStorage caching with TTL support
 */

interface CacheItem<T = unknown> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
  accessCount: number
  lastAccessed: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
}

export class CacheService {
  private memoryCache = new Map<string, CacheItem<unknown>>()
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, hitRate: 0 }
  private maxMemoryItems = 1000
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Cleanup expired items every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    
    // Load persistent cache from localStorage on initialization
    this.loadPersistentCache()
  }

  /**
   * Set item in memory cache with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    // Remove oldest items if cache is full
    if (this.memoryCache.size >= this.maxMemoryItems) {
      this.evictLRU()
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      accessCount: 0,
      lastAccessed: Date.now()
    }

    this.memoryCache.set(key, item)
    this.stats.size = this.memoryCache.size
  }

  /**
   * Get item from memory cache
   */
  get<T>(key: string): T | null {
    const item = this.memoryCache.get(key)
    
    if (!item) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.memoryCache.delete(key)
      this.stats.misses++
      this.stats.size = this.memoryCache.size
      this.updateHitRate()
      return null
    }

    // Update access statistics
    item.accessCount++
    item.lastAccessed = Date.now()
    
    this.stats.hits++
    this.updateHitRate()
    return item.data as T
  }

  /**
   * Set item in persistent localStorage cache
   */
  setPersistent<T>(key: string, data: T, ttlMs: number = 24 * 60 * 60 * 1000): void {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
        accessCount: 0,
        lastAccessed: Date.now()
      }
      
      localStorage.setItem(`cache_${key}`, JSON.stringify(item))
    } catch (error) {
      console.warn('Failed to set persistent cache item:', error)
    }
  }

  /**
   * Get item from persistent localStorage cache
   */
  getPersistent<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(`cache_${key}`)
      if (!stored) return null

      const item: CacheItem<T> = JSON.parse(stored)
      
      // Check if item has expired
      if (Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(`cache_${key}`)
        return null
      }

      return item.data
    } catch (error) {
      console.warn('Failed to get persistent cache item:', error)
      return null
    }
  }

  /**
   * Cache API responses with automatic key generation
   */
  async cacheApiCall<T>(
    key: string,
    apiCall: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000,
    persistent: boolean = false
  ): Promise<T> {
    // Try to get from cache first
    const cached = persistent ? this.getPersistent<T>(key) : this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Make API call and cache result
    try {
      const result = await apiCall()
      
      if (persistent) {
        this.setPersistent(key, result, ttlMs)
      } else {
        this.set(key, result, ttlMs)
      }
      
      return result
    } catch (err) {
      // Don't cache errors, just re-throw them
      console.warn(`Cache API call failed for key ${key}:`, err)
      throw err
    }
  }

  /**
   * Invalidate cache item
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key)
    localStorage.removeItem(`cache_${key}`)
    this.stats.size = this.memoryCache.size
  }

  /**
   * Invalidate cache items by pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key)
      }
    }
    
    // Clear localStorage cache
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cache_') && regex.test(key.substring(6))) {
        localStorage.removeItem(key)
      }
    }
    
    this.stats.size = this.memoryCache.size
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear()
    
    // Clear localStorage cache
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cache_')) {
        localStorage.removeItem(key)
      }
    }
    
    this.stats = { hits: 0, misses: 0, size: 0, hitRate: 0 }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get cache size information
   */
  getSizeInfo() {
    const memorySize = this.memoryCache.size
    let persistentSize = 0
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cache_')) {
        persistentSize++
      }
    }
    
    return {
      memory: memorySize,
      persistent: persistentSize,
      total: memorySize + persistentSize
    }
  }

  /**
   * Preload cache with common data
   */
  async preload(preloadConfig: Array<{ key: string; loader: () => Promise<unknown>; ttl?: number; persistent?: boolean }>) {
    const promises = preloadConfig.map(async config => {
      try {
        const data = await config.loader()
        if (config.persistent) {
          this.setPersistent(config.key, data, config.ttl)
        } else {
          this.set(config.key, data, config.ttl || 5 * 60 * 1000)
        }
      } catch (error) {
        console.warn(`Failed to preload cache for key ${config.key}:`, error)
      }
    })
    
    await Promise.allSettled(promises)
  }

  /**
   * Load persistent cache from localStorage
   */
  private loadPersistentCache(): void {
    // This method could be extended to load frequently accessed
    // persistent cache items into memory cache for faster access
  }

  /**
   * Cleanup expired items
   */
  private cleanup(): void {
    const now = Date.now()
    
    // Cleanup memory cache
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.memoryCache.delete(key)
      }
    }
    
    // Cleanup localStorage cache
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cache_')) {
        try {
          const stored = localStorage.getItem(key)
          if (stored) {
            const item = JSON.parse(stored)
            if (now - item.timestamp > item.ttl) {
              localStorage.removeItem(key)
            }
          }
        } catch {
          // Remove corrupted cache items
          localStorage.removeItem(key)
        }
      }
    }
    
    this.stats.size = this.memoryCache.size
  }

  /**
   * Evict least recently used items
   */
  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey)
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  /**
   * Cleanup on service destruction
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService()

// Cache key generators for common patterns
export const CacheKeys = {
  gameStats: (gameId: string) => `game_stats_${gameId}`,
  userProfile: (address: string) => `user_profile_${address}`,
  pixelData: (x: number, y: number) => `pixel_${x}_${y}`,
  gameState: (gameId: string) => `game_state_${gameId}`,
  leaderboard: (gameId: string, type: string) => `leaderboard_${gameId}_${type}`,
  apiResponse: (endpoint: string, params?: string) => `api_${endpoint}${params ? `_${params}` : ''}`,
}

export default cacheService