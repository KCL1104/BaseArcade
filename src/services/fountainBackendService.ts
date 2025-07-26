import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'

export interface FountainRound {
  roundId: string
  prizePool: string
  startTime: number
  endTime: number
  winner: string
  isComplete: boolean
  totalParticipants: number
  timeRemaining: number
  rolloverAmount?: string
  chromaFeesReceived?: string
}

export interface PrizeBreakdown {
  totalPool: string
  winnerAmount: string
  rolloverAmount: string
  platformFee: string
}

export interface ChromaFee {
  id: number
  round_id: number
  amount: string
  transaction_hash: string
  timestamp: string
}

export interface RolloverHistory {
  id: number
  from_round_id: number
  to_round_id: number
  rollover_amount: string
  timestamp: string
}

export interface FountainStats {
  totalRounds: string
  totalParticipants: string
  totalPrizesPaid: string
}

export interface FountainParticipant {
  participant_address: string
  timestamp: string
  transaction_hash: string
}

export interface FountainWinner {
  round_id: number
  winner_address: string
  prize_amount: string
  timestamp: string
  transaction_hash: string
}

export interface UserStats {
  totalParticipations: number
  totalWins: number
  totalWinnings: string
  winRate: string
}

export interface UserHistory {
  round_id: number
  entry_fee: string
  timestamp: string
  transaction_hash: string
  fountain_rounds: {
    start_time: string
    end_time: string
    prize_pool: string
    winner_address: string
    is_complete: boolean
  }
}

class FountainBackendService {
  private socket: Socket | null = null
  private baseUrl: string
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

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
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      this.socket.on('connect', () => {
        console.log('Connected to Fountain WebSocket')
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from Fountain WebSocket:', reason)
      })

      this.socket.on('connect_error', (error) => {
        console.error('Fountain WebSocket connection error:', error)
      })

      // Listen for fountain-specific events
      this.socket.on('coinTossed', (data) => {
        this.emit('coinTossed', data)
      })

      this.socket.on('roundStarted', (data) => {
        this.emit('roundStarted', data)
      })

      this.socket.on('winnerSelected', (data) => {
        this.emit('winnerSelected', data)
        toast.success(`Winner selected! ${this.formatAddress(data.winner)} won ${this.formatEther(data.prizeAmount)} ETH`)
      })

    } catch (error) {
      console.error('Failed to initialize Fountain WebSocket:', error)
    }
  }

  // Event listener management
  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(callback)
    }
  }

  private emit(event: string, data: unknown) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  // API Methods
  async getCurrentRound(): Promise<FountainRound> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/current-round`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get current round')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting current round:', error)
      throw error
    }
  }

  async getGameStats(): Promise<FountainStats> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/stats`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get game stats')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting game stats:', error)
      throw error
    }
  }

  async getRoundHistory(limit: number = 10, offset: number = 0): Promise<FountainRound[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/rounds?limit=${limit}&offset=${offset}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get round history')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting round history:', error)
      throw error
    }
  }

  async getRoundParticipants(roundId: number): Promise<FountainParticipant[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/rounds/${roundId}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get round participants')
      }
      
      return result.data.participants
    } catch (error) {
      console.error('Error getting round participants:', error)
      throw error
    }
  }

  async getUserStats(address: string): Promise<UserStats> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/users/${address}/stats`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get user stats')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting user stats:', error)
      throw error
    }
  }

  async getUserHistory(address: string, limit: number = 10, offset: number = 0): Promise<UserHistory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/users/${address}/history?limit=${limit}&offset=${offset}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get user history')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting user history:', error)
      throw error
    }
  }

  async getRecentWinners(limit: number = 10, offset: number = 0): Promise<FountainWinner[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/winners?limit=${limit}&offset=${offset}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get recent winners')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting recent winners:', error)
      throw error
    }
  }

  async getHealthStatus(): Promise<{ status: string; timestamp: string; uptime: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/health`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get health status')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting health status:', error)
      throw error
    }
  }

  async getCurrentPrizeBreakdown(): Promise<PrizeBreakdown> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/current-prize-breakdown`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get prize breakdown')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting prize breakdown:', error)
      throw error
    }
  }

  async getChromaFees(roundId?: number, limit: number = 50, offset: number = 0): Promise<ChromaFee[]> {
    try {
      let url = `${this.baseUrl}/api/fountain/chroma-fees?limit=${limit}&offset=${offset}`
      if (roundId) {
        url += `&roundId=${roundId}`
      }
      
      const response = await fetch(url)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get Chroma fees')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting Chroma fees:', error)
      throw error
    }
  }

  async getRolloverHistory(limit: number = 20, offset: number = 0): Promise<RolloverHistory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/rollover-history?limit=${limit}&offset=${offset}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get rollover history')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting rollover history:', error)
      throw error
    }
  }

  async getAccumulatedRollover(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fountain/accumulated-rollover`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get accumulated rollover')
      }
      
      return result.data.rollover
    } catch (error) {
      console.error('Error getting accumulated rollover:', error)
      throw error
    }
  }

  // Utility methods
  formatEther(wei: string): string {
    try {
      const value = BigInt(wei)
      const eth = Number(value) / 1e18
      return eth.toFixed(4)
    } catch (error) {
      console.error('Error formatting ether:', error)
      return '0.0000'
    }
  }

  formatAddress(address: string): string {
    if (!address || address.length < 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Round ended'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }

  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString()
    } catch {
      return timestamp
    }
  }

  // Cleanup
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }
}

// Export singleton instance
export const fountainBackendService = new FountainBackendService()
export default fountainBackendService