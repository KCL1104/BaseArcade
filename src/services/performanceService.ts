/**
 * Performance Monitoring and Optimization Service
 * Tracks application performance metrics and provides optimization insights
 */

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  category: 'render' | 'network' | 'memory' | 'user' | 'custom'
}

interface PerformanceReport {
  metrics: PerformanceMetric[]
  summary: {
    averageRenderTime: number
    averageNetworkTime: number
    memoryUsage: number
    frameRate: number
    userInteractionDelay: number
  }
  recommendations: string[]
}

export class PerformanceService {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000
  private frameCount = 0
  private lastFrameTime = 0
  private frameRates: number[] = []
  private renderTimes: number[] = []
  private networkTimes: number[] = []
  private userInteractionTimes: number[] = []
  private observer?: PerformanceObserver

  constructor() {
    this.initializePerformanceObserver()
    this.startFrameRateMonitoring()
  }

  /**
   * Initialize Performance Observer for automatic metric collection
   */
  private initializePerformanceObserver() {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry)
        }
      })

      try {
        // Observe navigation, resource, and measure entries
        this.observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'paint'] })
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error)
      }
    }
  }

  /**
   * Process performance entries from the observer
   */
  private processPerformanceEntry(entry: PerformanceEntry) {
    switch (entry.entryType) {
      case 'navigation': {
        const navEntry = entry as PerformanceNavigationTiming
        this.addMetric('page_load_time', navEntry.loadEventEnd - navEntry.fetchStart, 'network')
        this.addMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.fetchStart, 'render')
        break
      }
      case 'resource': {
        const resourceEntry = entry as PerformanceResourceTiming
        if (resourceEntry.initiatorType === 'fetch' || resourceEntry.initiatorType === 'xmlhttprequest') {
          this.addMetric(`network_${resourceEntry.name}`, resourceEntry.duration, 'network')
          this.networkTimes.push(resourceEntry.duration)
        }
        break
      }
      case 'paint':
        this.addMetric(entry.name, entry.startTime, 'render')
        break

      case 'measure':
        this.addMetric(entry.name, entry.duration, 'custom')
        break
    }
  }

  /**
   * Start monitoring frame rate
   */
  private startFrameRateMonitoring() {
    const measureFrameRate = () => {
      const now = performance.now()
      if (this.lastFrameTime > 0) {
        const frameTime = now - this.lastFrameTime
        const fps = 1000 / frameTime
        this.frameRates.push(fps)
        
        // Keep only last 60 frame rates (1 second at 60fps)
        if (this.frameRates.length > 60) {
          this.frameRates.shift()
        }
      }
      this.lastFrameTime = now
      this.frameCount++
      
      requestAnimationFrame(measureFrameRate)
    }
    
    requestAnimationFrame(measureFrameRate)
  }

  /**
   * Add a custom performance metric
   */
  addMetric(name: string, value: number, category: PerformanceMetric['category'] = 'custom') {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      category
    }

    this.metrics.push(metric)

    // Remove old metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }
  }

  /**
   * Measure render performance of a function
   */
  measureRender<T>(name: string, renderFunction: () => T): T {
    const startTime = performance.now()
    const result = renderFunction()
    const endTime = performance.now()
    const duration = endTime - startTime
    
    this.addMetric(`render_${name}`, duration, 'render')
    this.renderTimes.push(duration)
    
    // Keep only last 100 render times
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift()
    }
    
    return result
  }

  /**
   * Measure async operation performance
   */
  async measureAsync<T>(name: string, asyncFunction: () => Promise<T>): Promise<T> {
    const startTime = performance.now()
    try {
      const result = await asyncFunction()
      const endTime = performance.now()
      this.addMetric(`async_${name}`, endTime - startTime, 'network')
      return result
    } catch (error) {
      const endTime = performance.now()
      this.addMetric(`async_${name}_error`, endTime - startTime, 'network')
      throw error
    }
  }

  /**
   * Measure user interaction delay
   */
  measureUserInteraction(name: string, startTime: number) {
    const endTime = performance.now()
    const delay = endTime - startTime
    this.addMetric(`interaction_${name}`, delay, 'user')
    this.userInteractionTimes.push(delay)
    
    // Keep only last 50 interaction times
    if (this.userInteractionTimes.length > 50) {
      this.userInteractionTimes.shift()
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if ('memory' in performance) {
      const perfWithMemory = performance as Performance & {
        memory?: {
          usedJSHeapSize: number
          totalJSHeapSize: number
          jsHeapSizeLimit: number
        }
      }
      const memory = perfWithMemory.memory
      if (memory) {
        return {
          used: memory.usedJSHeapSize / 1024 / 1024, // MB
          total: memory.totalJSHeapSize / 1024 / 1024, // MB
          limit: memory.jsHeapSizeLimit / 1024 / 1024 // MB
        }
      }
    }
    return null
  }

  /**
   * Get current frame rate
   */
  getCurrentFrameRate(): number {
    if (this.frameRates.length === 0) return 0
    return this.frameRates.reduce((sum, fps) => sum + fps, 0) / this.frameRates.length
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): PerformanceReport['summary'] {
    const averageRenderTime = this.renderTimes.length > 0 
      ? this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length 
      : 0
    
    const averageNetworkTime = this.networkTimes.length > 0
      ? this.networkTimes.reduce((sum, time) => sum + time, 0) / this.networkTimes.length
      : 0
    
    const userInteractionDelay = this.userInteractionTimes.length > 0
      ? this.userInteractionTimes.reduce((sum, time) => sum + time, 0) / this.userInteractionTimes.length
      : 0
    
    const memoryUsage = this.getMemoryUsage()?.used || 0
    const frameRate = this.getCurrentFrameRate()

    return {
      averageRenderTime,
      averageNetworkTime,
      memoryUsage,
      frameRate,
      userInteractionDelay
    }
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(): string[] {
    const recommendations: string[] = []
    const summary = this.getPerformanceSummary()

    // Frame rate recommendations
    if (summary.frameRate < 30) {
      recommendations.push('Frame rate is low. Consider optimizing render operations or reducing visual complexity.')
    } else if (summary.frameRate < 50) {
      recommendations.push('Frame rate could be improved. Review render performance and consider code splitting.')
    }

    // Render time recommendations
    if (summary.averageRenderTime > 16) {
      recommendations.push('Render times are high. Consider using React.memo, useMemo, or useCallback for optimization.')
    }

    // Network recommendations
    if (summary.averageNetworkTime > 1000) {
      recommendations.push('Network requests are slow. Consider implementing caching or optimizing API responses.')
    }

    // Memory recommendations
    if (summary.memoryUsage > 100) {
      recommendations.push('Memory usage is high. Check for memory leaks and consider implementing cleanup in useEffect.')
    }

    // User interaction recommendations
    if (summary.userInteractionDelay > 100) {
      recommendations.push('User interactions have noticeable delay. Consider debouncing or throttling user inputs.')
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! Keep monitoring for any degradation.')
    }

    return recommendations
  }

  /**
   * Get full performance report
   */
  getPerformanceReport(): PerformanceReport {
    return {
      metrics: [...this.metrics],
      summary: this.getPerformanceSummary(),
      recommendations: this.generateRecommendations()
    }
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData() {
    const report = this.getPerformanceReport()
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-report-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = []
    this.frameRates = []
    this.renderTimes = []
    this.networkTimes = []
    this.userInteractionTimes = []
  }

  /**
   * Start performance monitoring session
   */
  startSession(sessionName: string) {
    performance.mark(`session_${sessionName}_start`)
    this.addMetric(`session_${sessionName}_started`, Date.now(), 'custom')
  }

  /**
   * End performance monitoring session
   */
  endSession(sessionName: string) {
    performance.mark(`session_${sessionName}_end`)
    performance.measure(
      `session_${sessionName}`,
      `session_${sessionName}_start`,
      `session_${sessionName}_end`
    )
    this.addMetric(`session_${sessionName}_ended`, Date.now(), 'custom')
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}

// Export singleton instance
export const performanceService = new PerformanceService()

// Performance monitoring hooks for React components
export const usePerformanceMonitoring = () => {
  const measureRender = <T>(name: string, renderFunction: () => T) => {
    return performanceService.measureRender(name, renderFunction)
  }

  const measureAsync = async <T>(name: string, asyncFunction: () => Promise<T>) => {
    return performanceService.measureAsync(name, asyncFunction)
  }

  const startInteraction = (name: string) => {
    const startTime = performance.now()
    return () => performanceService.measureUserInteraction(name, startTime)
  }

  return {
    measureRender,
    measureAsync,
    startInteraction,
    getReport: () => performanceService.getPerformanceReport(),
    exportData: () => performanceService.exportPerformanceData()
  }
}

export default performanceService