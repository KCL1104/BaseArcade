import { useState, useEffect } from 'react'
import type { Game } from '../types/game'

// Enhanced game data with real-time statistics integration
const getGameStats = async (gameId: string) => {
  try {
    if (gameId === 'chroma') {
      const response = await fetch('http://localhost:3001/api/game-stats')
      if (response.ok) {
        const data = await response.json()
        return {
          activePlayers: Math.floor(Math.random() * 50) + 10, // Simulated active players
          totalPlayers: data.uniqueArtists || 1337,
          totalTransactions: data.totalPixels || 5420,
          liveMetric: `${data.totalPixels || 12847} pixels placed`
        }
      }
    } else if (gameId === 'the-fountain') {
      // Simulated fountain stats
      return {
        activePlayers: Math.floor(Math.random() * 30) + 5,
        totalPlayers: 892,
        totalTransactions: 2156,
        liveMetric: `${(Math.random() * 5 + 1).toFixed(1)} ETH prize pool`
      }
    }
  } catch {
    console.log('Using fallback stats for', gameId)
  }
  
  // Fallback stats
  return gameId === 'chroma' 
    ? { activePlayers: 42, totalPlayers: 1337, totalTransactions: 5420, liveMetric: '12,847 pixels placed' }
    : { activePlayers: 28, totalPlayers: 892, totalTransactions: 2156, liveMetric: '2.4 ETH prize pool' }
}

const mockGames: Game[] = [
  {
    id: 'chroma',
    name: 'Chroma',
    description: 'A collaborative onchain pixel art canvas where every pixel tells a story. Place your mark on the eternal canvas.',
    emoji: '🎨',
    illustration: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=pixel%20art%20canvas%20with%20colorful%20pixels%20retro%20arcade%20style%20neon%20glow&image_size=landscape_4_3',
    status: 'active',
    contractAddress: '0x1234567890123456789012345678901234567890',
    stats: {
      activePlayers: 42,
      totalPlayers: 1337,
      totalTransactions: 5420,
      liveMetric: '12,847 pixels placed'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'the-fountain',
    name: 'The Fountain',
    description: 'Toss a coin into the magical onchain fountain and wish for fortune. Winners take home the growing prize pool.',
    emoji: '⛲',
    illustration: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=magical%20fountain%20with%20coins%20sparkling%20water%20retro%20arcade%20neon%20style&image_size=landscape_4_3',
    status: 'active',
    contractAddress: '0x2345678901234567890123456789012345678901',
    stats: {
      activePlayers: 28,
      totalPlayers: 892,
      totalTransactions: 2156,
      liveMetric: '2.4 ETH prize pool'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'pixel-wars',
    name: 'Pixel Wars',
    description: 'Competitive pixel claiming battles. Defend your territory and conquer new lands in this strategic onchain game.',
    emoji: '⚔️',
    illustration: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=pixel%20battle%20game%20with%20territories%20retro%20arcade%20neon%20style&image_size=landscape_4_3',
    status: 'coming_soon',
    stats: {
      activePlayers: 0,
      totalPlayers: 0,
      totalTransactions: 0,
      liveMetric: 'Coming Soon'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]

export function useGameRegistry() {
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setIsLoading(true)
        
        // Fetch live statistics for each game
        const gamesWithStats = await Promise.all(
          mockGames.map(async (game) => {
            if (game.status === 'active') {
              const liveStats = await getGameStats(game.id)
              return { ...game, stats: liveStats }
            }
            return game
          })
        )
        
        setGames(gamesWithStats)
      } catch {
        setError('Failed to load games')
        setGames(mockGames) // Fallback to static data
      } finally {
        setIsLoading(false)
      }
    }

    const refreshStats = async () => {
      const updatedGames = await Promise.all(
        mockGames.map(async (game) => {
          if (game.status === 'active') {
            const liveStats = await getGameStats(game.id)
            return { ...game, stats: liveStats }
          }
          return game
        })
      )
      setGames(updatedGames)
    }

    fetchGames()
    
    // Refresh stats every 30 seconds for live updates
    const interval = setInterval(refreshStats, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const getGameById = (id: string) => {
    return games.find(game => game.id === id)
  }

  const getActiveGames = () => {
    return games.filter(game => game.status === 'active')
  }

  const getTotalStats = () => {
    return games.reduce(
      (totals, game) => ({
        totalPlayers: totals.totalPlayers + (game.stats?.totalPlayers || 0),
        totalTransactions: totals.totalTransactions + (game.stats?.totalTransactions || 0),
        activePlayers: totals.activePlayers + (game.stats?.activePlayers || 0)
      }),
      { totalPlayers: 0, totalTransactions: 0, activePlayers: 0 }
    )
  }

  return {
    games,
    isLoading,
    error,
    getGameById,
    getActiveGames,
    getTotalStats
  }
}