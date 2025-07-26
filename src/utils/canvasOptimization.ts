/**
 * Canvas Performance Optimization Utilities
 * Provides optimized rendering techniques for better game performance
 */

export class CanvasOptimizer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private devicePixelRatio: number
  private frameId: number | null = null
  private lastFrameTime = 0
  private targetFPS = 60
  private frameInterval: number

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.devicePixelRatio = window.devicePixelRatio || 1
    this.frameInterval = 1000 / this.targetFPS
    this.setupCanvas()
  }

  /**
   * Setup canvas with proper scaling for high DPI displays
   */
  private setupCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    
    // Set actual size in memory (scaled to account for extra pixel density)
    this.canvas.width = rect.width * this.devicePixelRatio
    this.canvas.height = rect.height * this.devicePixelRatio
    
    // Scale the canvas back down using CSS
    this.canvas.style.width = rect.width + 'px'
    this.canvas.style.height = rect.height + 'px'
    
    // Scale the drawing context so everything draws at the correct size
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio)
    
    // Enable image smoothing for better quality
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
  }

  /**
   * Optimized animation loop with frame rate control
   */
  startAnimationLoop(renderCallback: (deltaTime: number) => void) {
    const animate = (currentTime: number) => {
      if (currentTime - this.lastFrameTime >= this.frameInterval) {
        const deltaTime = currentTime - this.lastFrameTime
        renderCallback(deltaTime)
        this.lastFrameTime = currentTime
      }
      this.frameId = requestAnimationFrame(animate)
    }
    
    this.frameId = requestAnimationFrame(animate)
  }

  /**
   * Stop the animation loop
   */
  stopAnimationLoop() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  /**
   * Clear canvas with optimized method
   */
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * Batch draw operations for better performance
   */
  batchDraw(operations: (() => void)[]) {
    this.ctx.save()
    operations.forEach(operation => operation())
    this.ctx.restore()
  }

  /**
   * Optimized pixel drawing for large pixel grids
   */
  drawPixelGrid(pixels: { x: number; y: number; color: string }[], pixelSize: number) {
    // Group pixels by color for batch drawing
    const pixelsByColor = new Map<string, { x: number; y: number }[]>()
    
    pixels.forEach(pixel => {
      if (!pixelsByColor.has(pixel.color)) {
        pixelsByColor.set(pixel.color, [])
      }
      pixelsByColor.get(pixel.color)!.push({ x: pixel.x, y: pixel.y })
    })

    // Draw all pixels of the same color in one batch
    pixelsByColor.forEach((positions, color) => {
      this.ctx.fillStyle = color
      positions.forEach(pos => {
        this.ctx.fillRect(pos.x * pixelSize, pos.y * pixelSize, pixelSize, pixelSize)
      })
    })
  }

  /**
   * Optimized image drawing with caching
   */
  private imageCache = new Map<string, HTMLImageElement>()
  
  async drawOptimizedImage(src: string, x: number, y: number, width?: number, height?: number) {
    let img = this.imageCache.get(src)
    
    if (!img) {
      img = new Image()
      img.src = src
      await new Promise((resolve, reject) => {
        img!.onload = resolve
        img!.onerror = reject
      })
      this.imageCache.set(src, img)
    }
    
    if (width && height) {
      this.ctx.drawImage(img, x, y, width, height)
    } else {
      this.ctx.drawImage(img, x, y)
    }
  }

  /**
   * Viewport culling - only render visible elements
   */
  isInViewport(x: number, y: number, width: number, height: number, viewportX = 0, viewportY = 0) {
    const canvasWidth = this.canvas.width / this.devicePixelRatio
    const canvasHeight = this.canvas.height / this.devicePixelRatio
    
    return (
      x + width >= viewportX &&
      x <= viewportX + canvasWidth &&
      y + height >= viewportY &&
      y <= viewportY + canvasHeight
    )
  }

  /**
   * Get canvas context with optimizations applied
   */
  getContext() {
    return this.ctx
  }

  /**
   * Get canvas element
   */
  getCanvas() {
    return this.canvas
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.stopAnimationLoop()
    this.imageCache.clear()
  }
}

/**
 * Debounce utility for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle utility for performance optimization
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Memory usage monitor for performance debugging
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor
  private measurements: number[] = []
  private maxMeasurements = 100

  static getInstance() {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor()
    }
    return MemoryMonitor.instance
  }

  measure() {
    if ('memory' in performance) {
      const perfWithMemory = performance as Performance & {
        memory?: {
          usedJSHeapSize: number
          totalJSHeapSize: number
          jsHeapSizeLimit: number
        }
      }
      const memory = perfWithMemory.memory
      if (!memory) return null
      const usage = memory.usedJSHeapSize / 1024 / 1024 // Convert to MB
      
      this.measurements.push(usage)
      if (this.measurements.length > this.maxMeasurements) {
        this.measurements.shift()
      }
      
      return {
        current: usage,
        average: this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length,
        peak: Math.max(...this.measurements)
      }
    }
    return null
  }

  getStats() {
    return {
      measurements: this.measurements.length,
      current: this.measurements[this.measurements.length - 1] || 0,
      average: this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length || 0,
      peak: Math.max(...this.measurements) || 0
    }
  }
}