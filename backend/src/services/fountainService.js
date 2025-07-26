require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')
const WebSocket = require('ws')

class FountainService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )
    this.provider = null
    this.contract = null
    this.wsClients = new Set()
    this.initializeBlockchain()
  }

  async initializeBlockchain() {
    try {
      this.provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL)
      
      // Contract ABI (simplified for backend)
      const contractABI = [
        'event CoinTossed(uint256 indexed roundId, address indexed participant, uint256 entryFee, uint256 newPrizePool, uint64 timestamp)',
        'event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime)',
        'event WinnerSelected(uint256 indexed roundId, address indexed winner, uint256 prizeAmount, uint64 timestamp)',
        'function getCurrentRound() view returns (tuple(uint256 prizePool, uint256 startTime, uint256 endTime, address winner, bool isComplete, uint256 totalParticipants))',
        'function getGameStats() view returns (uint256 totalRounds, uint256 totalParticipants, uint256 totalPrizesPaid)',
        'function getRound(uint256 roundId) view returns (tuple(uint256 prizePool, uint256 startTime, uint256 endTime, address winner, bool isComplete, uint256 totalParticipants))',
        'function getRoundParticipants(uint256 roundId) view returns (address[])',
        'function getTimeRemaining() view returns (uint256)',
        'function currentRoundId() view returns (uint256)',
        'function getAccumulatedRollover() view returns (uint256)',
        'function getCurrentPrizeBreakdown() view returns (uint256 totalPool, uint256 winnerShare, uint256 rolloverAmount, uint256 platformFee)',
        'event ChromaFeesReceived(uint256 indexed roundId, uint256 amount, uint256 newPrizePool)'
      ]
      
      this.contract = new ethers.Contract(
        process.env.FOUNTAIN_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
        contractABI,
        this.provider
      )
      
      this.setupEventListeners()
      console.log('Fountain blockchain service initialized')
    } catch (error) {
      console.error('Failed to initialize Fountain blockchain service:', error)
    }
  }

  setupEventListeners() {
    if (!this.contract) return

    // Listen for CoinTossed events
    this.contract.on('CoinTossed', async (roundId, participant, entryFee, newPrizePool, timestamp, event) => {
      try {
        await this.handleCoinTossed({
          roundId: roundId.toString(),
          participant: participant.toLowerCase(),
          entryFee: entryFee.toString(),
          newPrizePool: newPrizePool.toString(),
          timestamp: Number(timestamp),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        })
      } catch (error) {
        console.error('Error handling CoinTossed event:', error)
      }
    })

    // Listen for RoundStarted events
    this.contract.on('RoundStarted', async (roundId, startTime, endTime, event) => {
      try {
        await this.handleRoundStarted({
          roundId: roundId.toString(),
          startTime: Number(startTime),
          endTime: Number(endTime),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        })
      } catch (error) {
        console.error('Error handling RoundStarted event:', error)
      }
    })

    // Listen for WinnerSelected events
    this.contract.on('WinnerSelected', async (roundId, winner, prizeAmount, timestamp, event) => {
      try {
        await this.handleWinnerSelected({
          roundId: roundId.toString(),
          winner: winner.toLowerCase(),
          prizeAmount: prizeAmount.toString(),
          timestamp: Number(timestamp),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        })
      } catch (error) {
        console.error('Error handling WinnerSelected event:', error)
      }
    })

    console.log('Fountain event listeners set up')
  }

  async handleCoinTossed(data) {
    try {
      // Store coin toss in database
      const { error: tossError } = await this.supabase
        .from('fountain_tosses')
        .insert({
          round_id: parseInt(data.roundId),
          participant_address: data.participant,
          entry_fee: data.entryFee,
          transaction_hash: data.transactionHash,
          block_number: data.blockNumber,
          timestamp: new Date(data.timestamp * 1000).toISOString()
        })

      if (tossError) {
        console.error('Error storing coin toss:', tossError)
        return
      }

      // Update round prize pool
      const { error: roundError } = await this.supabase
        .from('fountain_rounds')
        .update({
          prize_pool: data.newPrizePool,
          total_participants: await this.getRoundParticipantCount(data.roundId)
        })
        .eq('round_id', parseInt(data.roundId))

      if (roundError) {
        console.error('Error updating round:', roundError)
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'coinTossed',
        data: {
          roundId: data.roundId,
          participant: data.participant,
          entryFee: data.entryFee,
          newPrizePool: data.newPrizePool,
          timestamp: data.timestamp
        }
      })

      console.log(`Coin tossed by ${data.participant} in round ${data.roundId}`)
    } catch (error) {
      console.error('Error in handleCoinTossed:', error)
    }
  }

  async handleRoundStarted(data) {
    try {
      // Store new round in database
      const { error } = await this.supabase
        .from('fountain_rounds')
        .insert({
          round_id: parseInt(data.roundId),
          start_time: new Date(data.startTime * 1000).toISOString(),
          end_time: new Date(data.endTime * 1000).toISOString(),
          prize_pool: '0',
          total_participants: 0,
          is_complete: false,
          transaction_hash: data.transactionHash,
          block_number: data.blockNumber
        })

      if (error) {
        console.error('Error storing round:', error)
        return
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'roundStarted',
        data: {
          roundId: data.roundId,
          startTime: data.startTime,
          endTime: data.endTime
        }
      })

      console.log(`Round ${data.roundId} started`)
    } catch (error) {
      console.error('Error in handleRoundStarted:', error)
    }
  }

  async handleWinnerSelected(data) {
    try {
      // Update round with winner
      const { error: roundError } = await this.supabase
        .from('fountain_rounds')
        .update({
          winner_address: data.winner,
          prize_amount: data.prizeAmount,
          is_complete: true,
          winner_selected_at: new Date(data.timestamp * 1000).toISOString()
        })
        .eq('round_id', parseInt(data.roundId))

      if (roundError) {
        console.error('Error updating round with winner:', roundError)
        return
      }

      // Store winner record
      const { error: winnerError } = await this.supabase
        .from('fountain_winners')
        .insert({
          round_id: parseInt(data.roundId),
          winner_address: data.winner,
          prize_amount: data.prizeAmount,
          transaction_hash: data.transactionHash,
          block_number: data.blockNumber,
          timestamp: new Date(data.timestamp * 1000).toISOString()
        })

      if (winnerError) {
        console.error('Error storing winner:', winnerError)
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'winnerSelected',
        data: {
          roundId: data.roundId,
          winner: data.winner,
          prizeAmount: data.prizeAmount,
          timestamp: data.timestamp
        }
      })

      console.log(`Winner selected for round ${data.roundId}: ${data.winner}`)
    } catch (error) {
      console.error('Error in handleWinnerSelected:', error)
    }
  }

  async getRoundParticipantCount(roundId) {
    try {
      if (!this.contract) return 0
      const participants = await this.contract.getRoundParticipants(roundId)
      return participants.length
    } catch (error) {
      console.error('Error getting participant count:', error)
      return 0
    }
  }

  // API Methods
  async getCurrentRound() {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const currentRound = await this.contract.getCurrentRound()
      const roundId = await this.contract.currentRoundId()
      const timeRemaining = await this.contract.getTimeRemaining()

      return {
        roundId: roundId.toString(),
        prizePool: currentRound.prizePool.toString(),
        startTime: Number(currentRound.startTime),
        endTime: Number(currentRound.endTime),
        winner: currentRound.winner,
        isComplete: currentRound.isComplete,
        totalParticipants: Number(currentRound.totalParticipants),
        timeRemaining: Number(timeRemaining)
      }
    } catch (error) {
      console.error('Error getting current round:', error)
      throw error
    }
  }

  async getGameStats() {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const stats = await this.contract.getGameStats()
      return {
        totalRounds: stats.totalRounds.toString(),
        totalParticipants: stats.totalParticipants.toString(),
        totalPrizesPaid: stats.totalPrizesPaid.toString()
      }
    } catch (error) {
      console.error('Error getting game stats:', error)
      throw error
    }
  }

  async getRoundHistory(limit = 10, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('fountain_rounds')
        .select(`
          *,
          fountain_winners(
            winner_address,
            prize_amount,
            timestamp
          )
        `)
        .order('round_id', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting round history:', error)
      throw error
    }
  }

  async getRoundParticipants(roundId) {
    try {
      const { data, error } = await this.supabase
        .from('fountain_tosses')
        .select('participant_address, timestamp, transaction_hash')
        .eq('round_id', roundId)
        .order('timestamp', { ascending: true })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting round participants:', error)
      throw error
    }
  }

  async getUserStats(address) {
    try {
      const lowerAddress = address.toLowerCase()

      // Get participation count
      const { data: tosses, error: tossError } = await this.supabase
        .from('fountain_tosses')
        .select('round_id')
        .eq('participant_address', lowerAddress)

      if (tossError) {
        throw tossError
      }

      // Get wins count and total winnings
      const { data: wins, error: winError } = await this.supabase
        .from('fountain_winners')
        .select('prize_amount')
        .eq('winner_address', lowerAddress)

      if (winError) {
        throw winError
      }

      const totalWinnings = wins.reduce((sum, win) => {
        return sum + BigInt(win.prize_amount)
      }, BigInt(0))

      return {
        totalParticipations: tosses.length,
        totalWins: wins.length,
        totalWinnings: totalWinnings.toString(),
        winRate: tosses.length > 0 ? (wins.length / tosses.length * 100).toFixed(2) : '0.00'
      }
    } catch (error) {
      console.error('Error getting user stats:', error)
      throw error
    }
  }

  async getAccumulatedRollover() {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const rollover = await this.contract.getAccumulatedRollover()
      return rollover.toString()
    } catch (error) {
      console.error('Error getting accumulated rollover:', error)
      throw error
    }
  }

  async getCurrentPrizeBreakdown() {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const breakdown = await this.contract.getCurrentPrizeBreakdown()
      return {
        totalPool: breakdown.totalPool.toString(),
        winnerShare: breakdown.winnerShare.toString(),
        rolloverAmount: breakdown.rolloverAmount.toString(),
        platformFee: breakdown.platformFee.toString()
      }
    } catch (error) {
      console.error('Error getting prize breakdown:', error)
      throw error
    }
  }

  async getChromaFees(roundId = null, limit = 10, offset = 0) {
    try {
      let query = this.supabase
        .from('fountain_chroma_fees')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1)

      if (roundId !== null) {
        query = query.eq('round_id', roundId)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting Chroma fees:', error)
      throw error
    }
  }

  async getRolloverHistory(limit = 10, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('fountain_rollover_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting rollover history:', error)
      throw error
    }
  }

  async getCurrentParticipation(address) {
    try {
      const lowerAddress = address.toLowerCase()
      
      // Get current round
      const currentRound = await this.getCurrentRound()
      if (!currentRound) {
        return { hasParticipated: false, currentRound: null }
      }

      // Check if user has participated in current round
      const { data, error } = await this.supabase
        .from('fountain_tosses')
        .select('*')
        .eq('participant_address', lowerAddress)
        .eq('round_id', currentRound.round_id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return {
        hasParticipated: !!data,
        currentRound: currentRound,
        participation: data || null
      }
    } catch (error) {
      console.error('Error getting current participation:', error)
      throw error
    }
  }

  async getLeaderboard(timeframe = 'all', limit = 10, offset = 0) {
    try {
      let query = this.supabase
        .from('fountain_winners')
        .select(`
          winner_address,
          prize_amount,
          timestamp,
          round_id
        `)

      // Apply timeframe filter
      if (timeframe === 'week') {
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        query = query.gte('timestamp', oneWeekAgo.toISOString())
      } else if (timeframe === 'month') {
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        query = query.gte('timestamp', oneMonthAgo.toISOString())
      }

      const { data, error } = await query
        .order('prize_amount', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      // Group by winner and sum their winnings
      const leaderboard = {}
      data.forEach(win => {
        const address = win.winner_address
        if (!leaderboard[address]) {
          leaderboard[address] = {
            address,
            totalWinnings: BigInt(0),
            winCount: 0,
            lastWin: win.timestamp
          }
        }
        leaderboard[address].totalWinnings += BigInt(win.prize_amount)
        leaderboard[address].winCount += 1
        if (new Date(win.timestamp) > new Date(leaderboard[address].lastWin)) {
          leaderboard[address].lastWin = win.timestamp
        }
      })

      // Convert to array and sort by total winnings
      const sortedLeaderboard = Object.values(leaderboard)
        .map(entry => ({
          ...entry,
          totalWinnings: entry.totalWinnings.toString()
        }))
        .sort((a, b) => BigInt(b.totalWinnings) - BigInt(a.totalWinnings))

      return sortedLeaderboard
    } catch (error) {
      console.error('Error getting leaderboard:', error)
      throw error
    }
  }

  async processCoinToss(tossData) {
    try {
      const { address, entryFee, transactionHash, gasUsed, gasPrice } = tossData
      
      // Get current round
      const currentRound = await this.getCurrentRound()
      if (!currentRound) {
        throw new Error('No active round found')
      }

      // Store the coin toss in database
      const { data, error } = await this.supabase
        .from('fountain_tosses')
        .insert({
          round_id: currentRound.round_id,
          participant_address: address.toLowerCase(),
          entry_fee: entryFee,
          transaction_hash: transactionHash,
          timestamp: new Date().toISOString(),
          gas_used: gasUsed,
          gas_price: gasPrice
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'coinToss',
        data: {
          roundId: currentRound.round_id,
          participant: address,
          entryFee,
          timestamp: new Date().toISOString()
        }
      })

      return {
        success: true,
        roundId: currentRound.round_id,
        participant: address,
        entryFee,
        transactionHash
      }
    } catch (error) {
      console.error('Error processing coin toss:', error)
      throw error
    }
  }

  // WebSocket Methods
  addWebSocketClient(ws) {
    this.wsClients.add(ws)
    
    ws.on('close', () => {
      this.wsClients.delete(ws)
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
      this.wsClients.delete(ws)
    })
  }

  removeWebSocketClient(ws) {
    this.wsClients.delete(ws)
  }

  broadcastToClients(message) {
    const messageStr = JSON.stringify(message)
    
    this.wsClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr)
        } catch (error) {
          console.error('Error sending WebSocket message:', error)
          this.wsClients.delete(ws)
        }
      } else {
        this.wsClients.delete(ws)
      }
    })
  }
}

module.exports = FountainService
