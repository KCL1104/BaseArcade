require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')
const WebSocket = require('ws')

class ChromaService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://nwlsvriplmcwiyzqrfyv.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bHN2cmlwbG1jd2l5enFyZnl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMTUzNjAsImV4cCI6MjA2ODg5MTM2MH0.RXcLhxRhx7oT5O3Rlh_cKSEKiwErJ626l7gfTYkzOXY'
    )
    this.provider = null
    this.contract = null
    this.wsClients = new Set()
    
    this.initializeBlockchain()
  }

  async initializeBlockchain() {
    try {
      console.log('Initializing Chroma blockchain connection...')
      
      this.provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL)
      
      // Contract ABI - focusing on pixel locking functions
      const abi = [
        'function getCanvasRegion(uint256 startX, uint256 startY, uint256 width, uint256 height) view returns (tuple(uint256 x, uint256 y, uint256 color, address owner, uint256 timestamp, uint256 heat)[])',
        'function getCanvasStats() view returns (tuple(uint256 totalPixelsPlaced, uint256 uniqueUsers, uint256 totalHeat))',
        'function getPixel(uint256 x, uint256 y) view returns (tuple(uint256 x, uint256 y, uint256 color, address owner, uint256 timestamp, uint256 heat))',
        'function getPixelPrice(uint256 x, uint256 y) view returns (uint256)',
        'function getUserStats(address user) view returns (tuple(uint256 pixelsPlaced, uint256 totalSpent, uint256 lastPlacementTime))',
        'function getLockPrice(uint256 x, uint256 y) view returns (uint256)',
        'function getUserCooldownTime(address user) view returns (uint256)',
        'function isUserOnCooldown(address user) view returns (bool)',
        'function lockPixel(uint256 x, uint256 y) payable',
        'event PixelChanged(uint256 indexed x, uint256 indexed y, uint256 color, address indexed owner)',
        'event PixelLocked(uint256 indexed x, uint256 indexed y, address indexed locker, uint256 lockPrice, uint256 timestamp)'
      ]
      
      this.contract = new ethers.Contract(
        process.env.CHROMA_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
        abi,
        this.provider
      )
      
      // Set up event listeners
      this.setupEventListeners()
      
      console.log('Chroma blockchain connection initialized successfully')
    } catch (error) {
      console.error('Error initializing Chroma blockchain:', error)
    }
  }

  setupEventListeners() {
    if (!this.contract) return

    // Listen for PixelChanged events
    this.contract.on('PixelChanged', async (x, y, color, owner, event) => {
      try {
        await this.handlePixelChanged({
          x: x.toString(),
          y: y.toString(),
          color: color.toString(),
          owner: owner,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: Math.floor(Date.now() / 1000)
        })
      } catch (error) {
        console.error('Error handling PixelChanged event:', error)
      }
    })

    // Listen for PixelLocked events
    this.contract.on('PixelLocked', async (x, y, locker, lockPrice, timestamp, event) => {
      try {
        await this.handlePixelLocked({
          x: x.toString(),
          y: y.toString(),
          locker: locker,
          lockPrice: lockPrice.toString(),
          timestamp: timestamp.toString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        })
      } catch (error) {
        console.error('Error handling PixelLocked event:', error)
      }
    })

    console.log('Chroma event listeners set up successfully')
  }

  async handlePixelChanged(data) {
    try {
      // Store pixel change in database
      const { error } = await this.supabase
        .from('chroma_pixels')
        .upsert({
          x: parseInt(data.x),
          y: parseInt(data.y),
          color: data.color,
          owner: data.owner.toLowerCase(),
          timestamp: new Date(data.timestamp * 1000).toISOString(),
          transaction_hash: data.transactionHash,
          block_number: data.blockNumber
        })

      if (error) {
        console.error('Error storing pixel change:', error)
        return
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'pixelChanged',
        data: {
          x: data.x,
          y: data.y,
          color: data.color,
          owner: data.owner,
          timestamp: data.timestamp
        }
      })

      console.log(`Pixel changed at (${data.x}, ${data.y}) by ${data.owner}`)
    } catch (error) {
      console.error('Error in handlePixelChanged:', error)
    }
  }

  async handlePixelLocked(data) {
    try {
      // Store pixel lock in database
      const { error } = await this.supabase
        .from('chroma_pixel_locks')
        .insert({
          x: parseInt(data.x),
          y: parseInt(data.y),
          locker: data.locker.toLowerCase(),
          lock_price: data.lockPrice,
          timestamp: new Date(parseInt(data.timestamp) * 1000).toISOString(),
          transaction_hash: data.transactionHash,
          block_number: data.blockNumber
        })

      if (error) {
        console.error('Error storing pixel lock:', error)
        return
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'pixelLocked',
        data: {
          x: data.x,
          y: data.y,
          locker: data.locker,
          lockPrice: data.lockPrice,
          timestamp: data.timestamp
        }
      })

      console.log(`Pixel locked at (${data.x}, ${data.y}) by ${data.locker}`)
    } catch (error) {
      console.error('Error in handlePixelLocked:', error)
    }
  }

  // API Methods
  async getCanvasRegion(startX, startY, width, height) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const pixels = await this.contract.getCanvasRegion(startX, startY, width, height)
      return pixels.map(pixel => ({
        x: pixel.x.toString(),
        y: pixel.y.toString(),
        color: pixel.color.toString(),
        owner: pixel.owner,
        timestamp: Number(pixel.timestamp),
        heat: pixel.heat.toString()
      }))
    } catch (error) {
      console.error('Error getting canvas region:', error)
      throw error
    }
  }

  async getCanvasStats() {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const stats = await this.contract.getCanvasStats()
      return {
        totalPixelsPlaced: stats.totalPixelsPlaced.toString(),
        uniqueUsers: stats.uniqueUsers.toString(),
        totalHeat: stats.totalHeat.toString()
      }
    } catch (error) {
      console.error('Error getting canvas stats:', error)
      throw error
    }
  }

  async getPixelPrice(x, y) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const price = await this.contract.getPixelPrice(x, y)
      return price.toString()
    } catch (error) {
      console.error('Error getting pixel price:', error)
      throw error
    }
  }

  async getLockPrice(x, y) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const price = await this.contract.getLockPrice(x, y)
      return price.toString()
    } catch (error) {
      console.error('Error getting lock price:', error)
      throw error
    }
  }

  async getUserCooldownTime(address) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const cooldownTime = await this.contract.getUserCooldownTime(address)
      return cooldownTime.toString()
    } catch (error) {
      console.error('Error getting user cooldown time:', error)
      throw error
    }
  }

  async isUserOnCooldown(address) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const onCooldown = await this.contract.isUserOnCooldown(address)
      return onCooldown
    } catch (error) {
      console.error('Error checking user cooldown:', error)
      throw error
    }
  }

  async getUserCooldown(address) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const [isOnCooldown, cooldownTime] = await Promise.all([
        this.contract.isUserOnCooldown(address),
        this.contract.getUserCooldownTime(address)
      ])

      return {
        isOnCooldown,
        cooldownTime: cooldownTime.toString(),
        cooldownEndsAt: isOnCooldown ? new Date(Date.now() + Number(cooldownTime) * 1000) : null
      }
    } catch (error) {
      console.error('Error getting user cooldown:', error)
      throw error
    }
  }

  async getLockedPixels(limit = 10, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('chroma_pixel_locks')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting locked pixels:', error)
      throw error
    }
  }

  async getUserStats(address) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized')
      }

      const stats = await this.contract.getUserStats(address)
      return {
        pixelsPlaced: stats.pixelsPlaced.toString(),
        totalSpent: stats.totalSpent.toString(),
        lastPlacementTime: Number(stats.lastPlacementTime)
      }
    } catch (error) {
      console.error('Error getting user stats:', error)
      throw error
    }
  }

  async getUserPixelHistory(address, limit = 10, offset = 0) {
    try {
      const lowerAddress = address.toLowerCase()

      const { data, error } = await this.supabase
        .from('chroma_pixels')
        .select('*')
        .eq('owner', lowerAddress)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting user pixel history:', error)
      throw error
    }
  }

  // Alias for getUserPixelHistory to match route expectations
  async getUserPixels(address, limit = 10, offset = 0) {
    return this.getUserPixelHistory(address, limit, offset)
  }

  async getRecentPixels(limit = 10, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('chroma_pixels')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting recent pixels:', error)
      throw error
    }
  }

  async placePixel(pixelData) {
    try {
      // Store pixel placement in database
      const { data, error } = await this.supabase
        .from('chroma_pixels')
        .upsert({
          x: pixelData.x,
          y: pixelData.y,
          color: pixelData.color,
          owner: pixelData.address.toLowerCase(),
          transaction_hash: pixelData.transactionHash,
          timestamp: new Date().toISOString(),
          gas_used: pixelData.gasUsed,
          gas_price: pixelData.gasPrice
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'pixelPlaced',
        data: {
          x: pixelData.x,
          y: pixelData.y,
          color: pixelData.color,
          owner: pixelData.address,
          timestamp: new Date().toISOString()
        }
      })

      return data
    } catch (error) {
      console.error('Error placing pixel:', error)
      throw error
    }
  }

  async lockPixel(lockData) {
    try {
      // Store pixel lock in database
      const { data, error } = await this.supabase
        .from('chroma_pixel_locks')
        .insert({
          x: lockData.x,
          y: lockData.y,
          locker: lockData.address.toLowerCase(),
          transaction_hash: lockData.transactionHash,
          timestamp: new Date().toISOString(),
          lock_duration: lockData.lockDuration || 3600
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'pixelLocked',
        data: {
          x: lockData.x,
          y: lockData.y,
          locker: lockData.address,
          timestamp: new Date().toISOString()
        }
      })

      return data
    } catch (error) {
      console.error('Error locking pixel:', error)
      throw error
    }
  }

  async getHealthStatus() {
    try {
      const isContractConnected = this.contract !== null
      const isDatabaseConnected = this.supabase !== null
      
      // Test database connection
      let dbStatus = 'connected'
      try {
        await this.supabase.from('chroma_pixels').select('count').limit(1)
      } catch (error) {
        dbStatus = 'disconnected'
      }

      // Test contract connection
      let contractStatus = 'connected'
      try {
        if (this.contract) {
          await this.contract.getCanvasStats()
        } else {
          contractStatus = 'disconnected'
        }
      } catch (error) {
        contractStatus = 'disconnected'
      }

      return {
        status: (dbStatus === 'connected' && contractStatus === 'connected') ? 'healthy' : 'unhealthy',
        database: dbStatus,
        contract: contractStatus,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error getting health status:', error)
      return {
        status: 'unhealthy',
        database: 'unknown',
        contract: 'unknown',
        timestamp: new Date().toISOString(),
        error: error.message
      }
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

module.exports = ChromaService