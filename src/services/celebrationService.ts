import { notificationService } from './notificationService'

export interface CelebrationOptions {
  duration?: number
  intensity?: 'low' | 'medium' | 'high'
  colors?: string[]
  sound?: boolean
  message?: string
  description?: string
}

export interface ParticleConfig {
  count: number
  colors: string[]
  duration: number
  spread: number
  origin: { x: number; y: number }
}

interface ConfettiFunction {
  (options: Record<string, unknown>): void
  reset?: () => void
}

class CelebrationService {
  private isConfettiLoaded = false
  private confetti: ConfettiFunction | null = null

  constructor() {
    this.loadConfetti()
  }

  // Dynamically load confetti library
  private async loadConfetti() {
    try {
      // Use dynamic import to load confetti
      const confettiModule = await import('canvas-confetti')
      this.confetti = confettiModule.default
      this.isConfettiLoaded = true
    } catch (error) {
      console.warn('Failed to load confetti library:', error)
    }
  }

  // Basic celebration with confetti
  celebrate(options: CelebrationOptions = {}) {
    const {
      duration = 3000,
      intensity = 'medium',
      colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'],
      message,
      description
    } = options

    // Show notification if message provided
    if (message) {
      notificationService.success(message, {
        description,
        duration: Math.min(duration, 6000)
      })
    }

    // Trigger confetti animation
    this.triggerConfetti({
      count: this.getParticleCount(intensity),
      colors,
      duration,
      spread: this.getSpread(intensity),
      origin: { x: 0.5, y: 0.6 }
    })
  }

  // Pixel placement celebration
  pixelPlaced(x: number, y: number, color: string) {
    this.celebrate({
      intensity: 'low',
      colors: [color, '#ffffff'],
      message: 'Pixel placed!',
      description: `Successfully placed pixel at (${x}, ${y})`,
      duration: 2000
    })
  }

  // Coin toss celebration
  coinTossed(amount?: string) {
    this.celebrate({
      intensity: 'medium',
      colors: ['#ffd700', '#ffed4e', '#f39c12'],
      message: 'Coin tossed!',
      description: `${amount} ETH tossed into the fountain`,
      duration: 3000
    })
  }

  // Big win celebration
  bigWin(amount: string, gameType: 'fountain' | 'chroma' = 'fountain') {
    const colors = gameType === 'fountain' 
      ? ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1']
      : ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4']

    this.celebrate({
      intensity: 'high',
      colors,
      message: '🎉 Congratulations!',
      description: `You won ${amount} ETH!`,
      duration: 5000
    })

    // Additional burst after delay
    setTimeout(() => {
      this.triggerConfetti({
        count: 50,
        colors,
        duration: 2000,
        spread: 120,
        origin: { x: 0.5, y: 0.3 }
      })
    }, 1000)
  }

  // Milestone celebration (e.g., 100th pixel, 10th coin toss)
  milestone(achievement: string, description?: string) {
    this.celebrate({
      intensity: 'high',
      colors: ['#9b59b6', '#e74c3c', '#f39c12', '#2ecc71'],
      message: `🏆 ${achievement}`,
      description,
      duration: 4000
    })
  }

  // Level up or achievement unlocked
  achievement(title: string, description?: string) {
    this.celebrate({
      intensity: 'medium',
      colors: ['#3498db', '#2ecc71', '#f39c12'],
      message: `⭐ ${title}`,
      description,
      duration: 3500
    })
  }

  // Welcome celebration for new users
  welcome() {
    this.celebrate({
      intensity: 'medium',
      colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c'],
      message: 'Welcome to Base Arcade!',
      description: 'Ready to start your onchain gaming adventure?',
      duration: 4000
    })
  }

  // Trigger confetti with specific configuration
  private triggerConfetti(config: ParticleConfig) {
    if (!this.isConfettiLoaded || !this.confetti) {
      console.warn('Confetti library not loaded')
      return
    }

    const { count, colors, duration, spread, origin } = config

    // Main burst
    this.confetti!({
      particleCount: count,
      spread,
      origin,
      colors,
      gravity: 0.6,
      drift: 0,
      ticks: duration / 16.67, // Convert duration to ticks (60fps)
      scalar: 1.2,
      shapes: ['circle', 'square']
    })

    // Side bursts for high intensity
    if (count > 100) {
      setTimeout(() => {
        this.confetti!({
          particleCount: count / 3,
          spread: spread / 2,
          origin: { x: 0.2, y: 0.6 },
          colors,
          gravity: 0.8
        })
      }, 200)

      setTimeout(() => {
        this.confetti!({
          particleCount: count / 3,
          spread: spread / 2,
          origin: { x: 0.8, y: 0.6 },
          colors,
          gravity: 0.8
        })
      }, 400)
    }
  }

  // Get particle count based on intensity
  private getParticleCount(intensity: 'low' | 'medium' | 'high'): number {
    switch (intensity) {
      case 'low': return 30
      case 'medium': return 75
      case 'high': return 150
      default: return 75
    }
  }

  // Get spread angle based on intensity
  private getSpread(intensity: 'low' | 'medium' | 'high'): number {
    switch (intensity) {
      case 'low': return 45
      case 'medium': return 70
      case 'high': return 100
      default: return 70
    }
  }

  // Custom confetti burst at specific coordinates
  burstAt(x: number, y: number, options: Partial<CelebrationOptions> = {}) {
    const {
      intensity = 'medium',
      colors = ['#ff6b6b', '#4ecdc4', '#45b7d1'],
      duration = 2000
    } = options

    this.triggerConfetti({
      count: this.getParticleCount(intensity),
      colors,
      duration,
      spread: this.getSpread(intensity),
      origin: { x: x / window.innerWidth, y: y / window.innerHeight }
    })
  }

  // Stop all celebrations
  stop() {
    if (this.confetti && this.confetti.reset) {
      this.confetti.reset()
    }
  }
}

// Export singleton instance
export const celebrationService = new CelebrationService()
export default celebrationService