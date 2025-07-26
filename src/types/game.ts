export interface GameStats {
  activePlayers: number
  totalPlayers: number
  totalTransactions: number
  liveMetric: string // e.g., "1,234 pixels placed", "0.5 ETH prize pool"
}

export interface Game {
  id: string
  name: string
  description: string
  emoji: string
  illustration?: string
  status: 'active' | 'coming_soon' | 'maintenance'
  contractAddress?: string
  stats?: GameStats
  createdAt: string
  updatedAt: string
}

export interface GameRegistry {
  games: Game[]
  totalGames: number
  activeGames: number
}