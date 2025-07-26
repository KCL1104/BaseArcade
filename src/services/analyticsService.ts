interface AnalyticsEvent {
  event: string
  properties?: Record<string, string | number | boolean | null | undefined>
  timestamp?: number
  userId?: string
  sessionId?: string
}

interface GameEvent extends AnalyticsEvent {
  gameId: string
  roundId?: string
  transactionHash?: string
}

interface UserEvent extends AnalyticsEvent {
  walletAddress?: string
  userAgent?: string
}

class AnalyticsService {
  private sessionId: string
  private userId: string | null = null
  private events: AnalyticsEvent[] = []
  private isEnabled: boolean = true
  private batchSize: number = 10
  private flushInterval: number = 30000 // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null

  constructor() {
    this.sessionId = this.generateSessionId()
    this.startFlushTimer()
    
    // Track page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    
    // Track page unload
    window.addEventListener('beforeunload', this.flush.bind(this))
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.track('page_hidden')
      this.flush()
    } else {
      this.track('page_visible')
    }
  }

  // Core tracking methods
  track(event: string, properties?: Record<string, string | number | boolean | null | undefined>): void {
    if (!this.isEnabled) return

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      userId: this.userId || undefined,
      sessionId: this.sessionId
    }

    this.events.push(analyticsEvent)
    console.log('Analytics Event:', analyticsEvent)

    // Auto-flush if batch size reached
    if (this.events.length >= this.batchSize) {
      this.flush()
    }
  }

  // User identification
  identify(walletAddress: string, properties?: Record<string, string | number | boolean | null | undefined>): void {
    this.userId = walletAddress
    this.track('user_identified', {
      walletAddress,
      ...properties
    })
  }

  // Game-specific tracking
  trackGameEvent(gameId: string, event: string, properties?: Record<string, string | number | boolean | null | undefined>): void {
    this.track(`game_${event}`, {
      gameId,
      ...properties
    })
  }

  // Wallet events
  trackWalletConnected(address: string): void {
    this.identify(address)
    this.track('wallet_connected', {
      walletAddress: address,
      network: 'base'
    })
  }

  trackWalletDisconnected(): void {
    this.track('wallet_disconnected', {
      previousAddress: this.userId
    })
    this.userId = null
  }

  // Transaction events
  trackTransactionStarted(hash: string, type: string, gameId?: string): void {
    this.track('transaction_started', {
      transactionHash: hash,
      transactionType: type,
      gameId
    })
  }

  trackTransactionCompleted(hash: string, type: string, gameId?: string): void {
    this.track('transaction_completed', {
      transactionHash: hash,
      transactionType: type,
      gameId
    })
  }

  trackTransactionFailed(hash: string, type: string, error: string, gameId?: string): void {
    this.track('transaction_failed', {
      transactionHash: hash,
      transactionType: type,
      error,
      gameId
    })
  }

  // Game-specific events
  trackPixelPlaced(x: number, y: number, color: string, price: string): void {
    this.trackGameEvent('chroma', 'pixel_placed', {
      coordinates: `${x},${y}`,
      color,
      price
    })
  }

  trackCoinTossed(roundId: string, entryFee: string): void {
    this.trackGameEvent('fountain', 'coin_tossed', {
      roundId,
      entryFee
    })
  }

  trackRoundWon(roundId: string, prizeAmount: string): void {
    this.trackGameEvent('fountain', 'round_won', {
      roundId,
      prizeAmount
    })
  }

  // Navigation events
  trackPageView(path: string): void {
    this.track('page_view', {
      path,
      title: document.title
    })
  }

  trackGameLaunched(gameId: string): void {
    this.trackGameEvent(gameId, 'launched')
  }

  trackGameExited(gameId: string, timeSpent?: number): void {
    this.trackGameEvent(gameId, 'exited', {
      timeSpent
    })
  }

  // Error tracking
  trackError(error: Error, context?: Record<string, string | number | boolean | null | undefined>): void {
    this.track('error_occurred', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      ...context
    })
  }

  // Performance tracking
  trackPerformance(metric: string, value: number, unit: string = 'ms'): void {
    this.track('performance_metric', {
      metric,
      value,
      unit
    })
  }

  // User engagement
  trackFeatureUsed(feature: string, properties?: Record<string, string | number | boolean | null | undefined>): void {
    this.track('feature_used', {
      feature,
      ...properties
    })
  }

  trackTimeSpent(page: string, timeSpent: number): void {
    this.track('time_spent', {
      page,
      timeSpent,
      unit: 'seconds'
    })
  }

  // Data management
  flush(): void {
    if (this.events.length === 0) return

    const eventsToSend = [...this.events]
    this.events = []

    // In a real implementation, you would send these to your analytics backend
    // For now, we'll just log them and store in localStorage for debugging
    try {
      const existingEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]')
      const allEvents = [...existingEvents, ...eventsToSend]
      
      // Keep only last 1000 events to prevent localStorage overflow
      const recentEvents = allEvents.slice(-1000)
      localStorage.setItem('analytics_events', JSON.stringify(recentEvents))
      
      console.log(`Flushed ${eventsToSend.length} analytics events`)
    } catch (error) {
      console.error('Failed to store analytics events:', error)
    }
  }

  // Configuration
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (!enabled) {
      this.flush()
    }
  }

  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, size)
  }

  setFlushInterval(interval: number): void {
    this.flushInterval = Math.max(1000, interval)
    this.startFlushTimer()
  }

  // Debug methods
  getStoredEvents(): AnalyticsEvent[] {
    try {
      return JSON.parse(localStorage.getItem('analytics_events') || '[]')
    } catch {
      return []
    }
  }

  clearStoredEvents(): void {
    localStorage.removeItem('analytics_events')
  }

  getSessionInfo(): { sessionId: string; userId: string | null; eventsCount: number } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      eventsCount: this.events.length
    }
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    window.removeEventListener('beforeunload', this.flush.bind(this))
    
    this.flush()
  }
}

// Create and export singleton instance
export const analyticsService = new AnalyticsService()

// Export types for external use
export type { AnalyticsEvent, GameEvent, UserEvent }