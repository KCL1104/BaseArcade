import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'

export interface Pixel {
  id?: number
  x: number
  y: number
  color: string
  owner: string
  price: string
  timestamp: Date
  transaction_hash: string
  locked_until?: Date
  is_locked?: boolean
  lock_price?: string
}

export interface UserCooldown {
  user_address: string
  last_placement: Date
  cooldown_until: Date
  remaining_seconds: number
}

export interface LockPriceResponse {
  success: boolean
  data: {
    coordinates: { x: number; y: number }
    lockPrice: string
    normalPrice: string
  }
}

export interface CanvasRegionResponse {
  success: boolean
  data: {
    pixels: Pixel[]
    region: {
      x: number
      y: number
      width: number
      height: number
    }
    count: number
  }
}

export interface GameStatsResponse {
  success: boolean
  data: {
    totalPixels: number
    totalRevenue: string
    uniqueArtists: number
    recentActivity: number
    topArtists: Array<{
      address: string
      pixelCount: number
      totalSpent: string
    }>
  }
}

export interface PixelPriceResponse {
  success: boolean
  data: {
    coordinates: { x: number; y: number }
    price: string
  }
}

class ChromaBackendService {
  private socket: Socket | null = null
  private baseUrl: string
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private pixelUpdateCallbacks: Array<(pixel: Pixel) => void> = []
  private statsUpdateCallbacks: Array<(stats: GameStatsResponse['data']) => void> = []

  constructor() {
    this.baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
    this.initializeSocket()
  }

  private initializeSocket() {
    try {
      this.socket = io(this.baseUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      })

      this.socket.on('connect', () => {
        console.log('Connected to Chroma backend')
        this.isConnected = true
        this.reconnectAttempts = 0
        
        // Join the canvas room for real-time updates
        this.socket?.emit('join-canvas')
      })

      this.socket.on('disconnect', () => {
        console.log('Disconnected from Chroma backend')
        this.isConnected = false
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        this.reconnectAttempts++
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          toast.error('Failed to connect to real-time updates')
        }
      })

      // Listen for pixel updates
      this.socket.on('pixel-updated', (pixel: Pixel) => {
        console.log('Received pixel update:', pixel)
        this.pixelUpdateCallbacks.forEach(callback => callback(pixel))
      })

      // Listen for stats updates
      this.socket.on('stats-updated', (stats: GameStatsResponse['data']) => {
        console.log('Received stats update:', stats)
        this.statsUpdateCallbacks.forEach(callback => callback(stats))
      })

    } catch (error) {
      console.error('Failed to initialize socket:', error)
    }
  }

  // Subscribe to pixel updates
  onPixelUpdate(callback: (pixel: Pixel) => void) {
    this.pixelUpdateCallbacks.push(callback)
    return () => {
      const index = this.pixelUpdateCallbacks.indexOf(callback)
      if (index > -1) {
        this.pixelUpdateCallbacks.splice(index, 1)
      }
    }
  }

  // Subscribe to stats updates
  onStatsUpdate(callback: (stats: GameStatsResponse['data']) => void) {
    this.statsUpdateCallbacks.push(callback)
    return () => {
      const index = this.statsUpdateCallbacks.indexOf(callback)
      if (index > -1) {
        this.statsUpdateCallbacks.splice(index, 1)
      }
    }
  }

  // API Methods
  async getCanvasRegion(startX: number, startY: number, width: number, height: number): Promise<Pixel[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/chroma/canvas?startX=${startX}&startY=${startY}&width=${width}&height=${height}`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error('Error fetching canvas region:', error)
      throw error
    }
  }

  async getPixel(x: number, y: number): Promise<Pixel | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/canvas/pixel/${x}/${y}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data.pixel
    } catch (error) {
      console.error('Error fetching pixel:', error)
      throw error
    }
  }

  async getPixelPrice(x: number, y: number): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chroma/pixel/${x}/${y}/price`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data.price
    } catch (error) {
      console.error('Error fetching pixel price:', error)
      throw error
    }
  }

  async getGameStats(): Promise<GameStatsResponse['data']> {
    try {
      const response = await fetch(`${this.baseUrl}/chroma/stats`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data
    } catch (error) {
      console.error('Error fetching game stats:', error)
      throw error
    }
  }

  async getLockPrice(x: number, y: number): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chroma/pixel/${x}/${y}/lock-price`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data.lockPrice
    } catch (error) {
      console.error('Error fetching lock price:', error)
      throw error
    }
  }

  async getUserCooldown(address: string): Promise<{ remainingTime: number; canPlace: boolean } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/chroma/users/${address}/cooldown`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null // User has no cooldown
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data
    } catch (error) {
      console.error('Error fetching user cooldown:', error)
      throw error
    }
  }

  async getLockedPixels(limit: number = 50, offset: number = 0): Promise<Pixel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/chroma/locked-pixels?limit=${limit}&offset=${offset}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error('Error fetching locked pixels:', error)
      throw error
    }
  }

  async getRecentPixels(limit: number = 50): Promise<Pixel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/canvas/recent?limit=${limit}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data.pixels
    } catch (error) {
      console.error('Error fetching recent pixels:', error)
      throw error
    }
  }

  // Utility methods
  isSocketConnected(): boolean {
    return this.isConnected
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  reconnect() {
    if (this.socket) {
      this.socket.connect()
    } else {
      this.initializeSocket()
    }
  }
}

// Export singleton instance
export const chromaBackendService = new ChromaBackendService()
export default chromaBackendService