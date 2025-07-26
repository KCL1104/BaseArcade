import React, { useState, useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther } from 'viem'
import { Trophy, Users, Coins, Sparkles, Timer } from 'lucide-react'
import { FOUNTAIN_ABI, FOUNTAIN_CONTRACT_ADDRESS, ENTRY_FEE } from '../../contracts/TheFountainContract'
import fountainBackendService, { type FountainRound, type FountainStats, type UserStats } from '../../services/fountainBackendService'
import { notificationService } from '../../services/notificationService'

import { celebrationService } from '../../services/celebrationService'
import { analyticsService } from '../../services/analyticsService'

interface FountainGameProps {
  className?: string
}

const FountainGame: React.FC<FountainGameProps> = ({ className = '' }) => {
  const { address, isConnected } = useAccount()
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  
  // Track game launch
  useEffect(() => {
    analyticsService.trackGameLaunched('fountain')
    const startTime = Date.now()
    
    return () => {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000)
      analyticsService.trackGameExited('fountain', timeSpent)
    }
  }, [])

  // Game state
  const [currentRound, setCurrentRound] = useState<FountainRound | null>(null)
  const [gameStats, setGameStats] = useState<FountainStats | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [hasParticipated, setHasParticipated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load initial data
  const loadGameData = useCallback(async () => {
    try {
      setLoading(true)
      const [round, stats] = await Promise.all([
        fountainBackendService.getCurrentRound(),
        fountainBackendService.getGameStats()
      ])
      
      setCurrentRound(round)
      setGameStats(stats)
      setTimeRemaining(round.timeRemaining)
      
      // Check if user has participated in current round
      if (address && round.roundId) {
        try {
          const participants = await fountainBackendService.getRoundParticipants(parseInt(round.roundId))
          const participated = participants.some(p => p.participant_address.toLowerCase() === address.toLowerCase())
          setHasParticipated(participated)
        } catch (error) {
          console.error('Error checking participation:', error)
        }
      }
    } catch (error) {
      console.error('Error loading game data:', error)
      notificationService.error('Failed to load game data')
    } finally {
      setLoading(false)
    }
  }, [address])

  // Load user stats
  const loadUserStats = useCallback(async () => {
    if (!address) return
    
    try {
      const stats = await fountainBackendService.getUserStats(address)
      setUserStats(stats)
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }, [address])

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) return
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Round ended, reload data
          loadGameData()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [timeRemaining, loadGameData])

  // Load data on mount and when address changes
  useEffect(() => {
    loadGameData()
  }, [loadGameData])

  useEffect(() => {
    loadUserStats()
  }, [loadUserStats])

  // WebSocket event listeners
  useEffect(() => {
    const handleCoinTossed = (...args: unknown[]) => {
      const data = args[0] as { participant: string; newPrizePool: string }
      if (data.participant.toLowerCase() === address?.toLowerCase()) {
        setHasParticipated(true)
        notificationService.coinTossed()
        celebrationService.coinTossed()
      } else {
        notificationService.info('Another player tossed a coin!')
      }
      
      // Update current round data
      setCurrentRound(prev => prev ? {
        ...prev,
        prizePool: data.newPrizePool,
        totalParticipants: prev.totalParticipants + 1
      } : null)
    }

    const handleRoundStarted = () => {
      setHasParticipated(false)
      loadGameData()
      notificationService.info('🎉 New round started! Toss your coin for a chance to win!')
    }

    const handleWinnerSelected = (...args: unknown[]) => {
      const data = args[0] as { winner: string; prizeAmount: string; roundId: string }
      setHasParticipated(false)
      loadGameData()
      loadUserStats()
      
      if (data.winner?.toLowerCase() === address?.toLowerCase()) {
         notificationService.roundWon(formatEther(BigInt(data.prizeAmount)))
         celebrationService.bigWin(currentRound?.prizePool?.toString() || '0')
         
         // Track round win
         analyticsService.trackRoundWon(
           data.roundId || 'unknown',
           formatEther(BigInt(data.prizeAmount))
         )
       } else {
        notificationService.info(`Round ended! Winner: ${data.winner?.slice(0, 8)}...`)
      }
    }

    fountainBackendService.on('coinTossed', handleCoinTossed)
    fountainBackendService.on('roundStarted', handleRoundStarted)
    fountainBackendService.on('winnerSelected', handleWinnerSelected)

    return () => {
      fountainBackendService.off('coinTossed', handleCoinTossed)
      fountainBackendService.off('roundStarted', handleRoundStarted)
      fountainBackendService.off('winnerSelected', handleWinnerSelected)
    }
  }, [address, loadGameData, loadUserStats, currentRound?.prizePool])

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      setIsAnimating(false)
      loadGameData()
      loadUserStats()
    }
  }, [isConfirmed, loadGameData, loadUserStats])

  // Handle transaction error
  useEffect(() => {
    if (error) {
      setIsAnimating(false)
      notificationService.error(notificationService.formatError(error as Error))
    }
  }, [error])

  const handleTossCoin = async () => {
    if (!isConnected || !address) {
      notificationService.walletConnectionError('Please connect your wallet to play')
      return
    }

    if (hasParticipated) {
      notificationService.warning('You have already participated in this round')
      return
    }

    if (!currentRound || currentRound.isComplete) {
      notificationService.error('No active round available')
      return
    }

    try {
      setIsAnimating(true)
      
      await writeContract({
        address: FOUNTAIN_CONTRACT_ADDRESS,
        abi: FOUNTAIN_ABI,
        functionName: 'tossCoin',
        value: ENTRY_FEE
      })
      
      // Transaction successful, proceed with tracking and updates
      notificationService.coinTossed()
      celebrationService.coinTossed()
      
      // Track successful coin toss
      analyticsService.trackCoinTossed(
        currentRound?.roundId || 'unknown',
        formatEther(ENTRY_FEE)
      )
      
      setHasParticipated(true)
      await Promise.all([
        loadGameData(),
        loadUserStats()
      ])
    } catch (error) {
      setIsAnimating(false)
      console.error('Error tossing coin:', error)
      notificationService.error(notificationService.formatError(error as Error))
    }
  }

  const formatTimeRemaining = (seconds: number): string => {
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

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading The Fountain...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 ${className}`}>
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Sparkles className="h-12 w-12 text-yellow-400" />
            The Fountain
            <Sparkles className="h-12 w-12 text-yellow-400" />
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Toss a coin into the magical fountain and wish for fortune. Every 24 hours, one lucky participant wins the entire prize pool!
          </p>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="h-6 w-6 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">Total Rounds</h3>
            </div>
            <p className="text-3xl font-bold text-white">{gameStats?.totalRounds || '0'}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-6 w-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Total Players</h3>
            </div>
            <p className="text-3xl font-bold text-white">{gameStats?.totalParticipants || '0'}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="h-6 w-6 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Total Prizes</h3>
            </div>
            <p className="text-3xl font-bold text-white">
              {gameStats ? `${formatEther(BigInt(gameStats.totalPrizesPaid))} ETH` : '0 ETH'}
            </p>
          </div>
        </div>

        {/* Current Round */}
        {currentRound && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 mb-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">Round #{currentRound.roundId}</h2>
              <div className="flex items-center justify-center gap-2 text-xl text-blue-200">
                <Timer className="h-6 w-6" />
                <span>{formatTimeRemaining(timeRemaining)}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Prize Pool */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Prize Pool</h3>
                <div className="text-4xl font-bold text-yellow-400 mb-2">
                  {formatEther(BigInt(currentRound.prizePool))} ETH
                </div>
                <p className="text-blue-200">{currentRound.totalParticipants} participants</p>
              </div>
              
              {/* Fountain Animation */}
              <div className="flex flex-col items-center">
                <div className="relative mb-6">
                  {/* Fountain Base */}
                  <div className="w-32 h-32 bg-gradient-to-t from-stone-600 to-stone-400 rounded-full border-4 border-stone-300 relative overflow-hidden">
                    {/* Water */}
                    <div className="absolute inset-2 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full">
                      {/* Water ripples */}
                      <div className="absolute inset-0 rounded-full">
                        <div className="absolute top-2 left-2 w-4 h-4 bg-white/30 rounded-full animate-ping"></div>
                        <div className="absolute top-4 right-3 w-3 h-3 bg-white/20 rounded-full animate-ping animation-delay-300"></div>
                        <div className="absolute bottom-3 left-4 w-2 h-2 bg-white/40 rounded-full animate-ping animation-delay-600"></div>
                      </div>
                    </div>
                    
                    {/* Coin animation */}
                    {isAnimating && (
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                        <div className="w-6 h-6 bg-yellow-400 rounded-full animate-bounce border-2 border-yellow-600 shadow-lg">
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Sparkles around fountain */}
                  <div className="absolute -inset-4">
                    <Sparkles className="absolute top-0 left-0 h-4 w-4 text-yellow-400 animate-pulse" />
                    <Sparkles className="absolute top-2 right-0 h-3 w-3 text-blue-400 animate-pulse animation-delay-300" />
                    <Sparkles className="absolute bottom-0 left-2 h-3 w-3 text-purple-400 animate-pulse animation-delay-600" />
                    <Sparkles className="absolute bottom-2 right-2 h-4 w-4 text-pink-400 animate-pulse animation-delay-900" />
                  </div>
                </div>
                
                {/* Toss Coin Button */}
                <button
                  onClick={handleTossCoin}
                  disabled={!isConnected || hasParticipated || isPending || isConfirming || currentRound.isComplete || timeRemaining <= 0}
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {!isConnected ? 'Connect Wallet' :
                   hasParticipated ? 'Already Participated' :
                   isPending ? 'Confirming...' :
                   isConfirming ? 'Processing...' :
                   currentRound.isComplete ? 'Round Complete' :
                   timeRemaining <= 0 ? 'Round Ended' :
                   `Toss Coin (${formatEther(ENTRY_FEE)} ETH)`}
                </button>
                
                {hasParticipated && (
                  <p className="text-green-400 mt-2 font-semibold">✨ Good luck! You're in this round!</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User Stats */}
        {isConnected && userStats && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-4">Your Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{userStats.totalParticipations}</p>
                <p className="text-blue-200 text-sm">Participations</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{userStats.totalWins}</p>
                <p className="text-blue-200 text-sm">Wins</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{userStats.winRate}%</p>
                <p className="text-blue-200 text-sm">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  {formatEther(BigInt(userStats.totalWinnings))} ETH
                </p>
                <p className="text-blue-200 text-sm">Total Winnings</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FountainGame