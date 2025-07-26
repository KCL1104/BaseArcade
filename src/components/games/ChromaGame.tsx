import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { Palette, ZoomIn, ZoomOut, Info, Users, Wifi, WifiOff, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Navigation } from 'lucide-react'
import { ethers } from 'ethers'
import { getChromaContract, formatPixelColor, parsePixelColor, formatPrice, type CanvasStats } from '../../contracts/ChromaContract'
import chromaBackendService, { type Pixel as BackendPixel, type GameStatsResponse } from '../../services/chromaBackendService'
import { notificationService } from '../../services/notificationService'
import { transactionService } from '../../services/transactionService'
import { celebrationService } from '../../services/celebrationService'
import { analyticsService } from '../../services/analyticsService'

// Canvas configuration
const CANVAS_WIDTH = 3000
const CANVAS_HEIGHT = 3000
const VIEWPORT_WIDTH = 100 // Show 100x100 pixels at a time
const VIEWPORT_HEIGHT = 100

export function ChromaGame() {
  const { isConnected, address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  
  // Track game launch
  useEffect(() => {
    analyticsService.trackGameLaunched('chroma')
    const startTime = Date.now()
    
    return () => {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000)
      analyticsService.trackGameExited('chroma', timeSpent)
    }
  }, [])
  const [selectedColor, setSelectedColor] = useState('#ff00ff')
  const [selectedPixel, setSelectedPixel] = useState<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [canvasStats, setCanvasStats] = useState<CanvasStats | null>(null)
  const [userPixelCount, setUserPixelCount] = useState<number>(0)
  const [pixelPrice, setPixelPrice] = useState<string>('0')
  const [lockPrice, setLockPrice] = useState<string>('0')
  const [userCooldown, setUserCooldown] = useState<{ remainingTime: number; canPlace: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLockMode, setIsLockMode] = useState(false)
  const [pixels, setPixels] = useState<Map<string, BackendPixel>>(new Map())
  const [gameStats, setGameStats] = useState<GameStatsResponse['data'] | null>(null)
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  
  // Viewport state
  const [viewportX, setViewportX] = useState(1400) // Start near center
  const [viewportY, setViewportY] = useState(1400)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  const colors = [
    '#ff00ff', '#00ffff', '#ff0040', '#00ff00', '#ff8c00', '#8b5cf6',
    '#ffffff', '#000000', '#ffff00', '#ff69b4', '#00ff7f', '#1e90ff'
  ]

  // Viewport navigation functions
  const moveViewport = useCallback((deltaX: number, deltaY: number) => {
    setViewportX(prev => Math.max(0, Math.min(CANVAS_WIDTH - VIEWPORT_WIDTH, prev + deltaX)))
    setViewportY(prev => Math.max(0, Math.min(CANVAS_HEIGHT - VIEWPORT_HEIGHT, prev + deltaY)))
  }, [])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const step = 10
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        moveViewport(0, -step)
        break
      case 'ArrowDown':
        e.preventDefault()
        moveViewport(0, step)
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveViewport(-step, 0)
        break
      case 'ArrowRight':
        e.preventDefault()
        moveViewport(step, 0)
        break
    }
  }, [moveViewport])
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [])
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return
    
    const deltaX = Math.floor((dragStart.x - e.clientX) / 4)
    const deltaY = Math.floor((dragStart.y - e.clientY) / 4)
    
    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
      moveViewport(deltaX, deltaY)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }, [isDragging, dragStart, moveViewport])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
  }, [])
  
  // Define all callback functions first
  const loadCanvasData = useCallback(async () => {
    try {
      // Try to load from backend first for better performance
      try {
        const backendPixels = await chromaBackendService.getCanvasRegion(
          viewportX, 
          viewportY, 
          VIEWPORT_WIDTH, 
          VIEWPORT_HEIGHT
        )
        const pixelMap = new Map<string, BackendPixel>()
        
        backendPixels.forEach((pixel: BackendPixel) => {
          pixelMap.set(`${pixel.x},${pixel.y}`, pixel)
        })
        
        setPixels(pixelMap)
        setIsBackendConnected(true)
        
        // Also load blockchain stats if wallet is connected
        if (publicClient && window.ethereum) {
          try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const contract = getChromaContract(provider)
            const stats = await contract.getCanvasStats()
            setCanvasStats({
              totalPlaced: stats[0],
              canvasSize: stats[1]
            })
          } catch (statsError) {
            console.warn('Could not load blockchain stats:', statsError)
          }
        }
        
        return
      } catch (backendError) {
        console.warn('Backend unavailable, falling back to blockchain:', backendError)
        setIsBackendConnected(false)
      }
      
      // Fallback to blockchain if backend is unavailable and wallet is connected
      if (!publicClient || !window.ethereum) {
        console.log('No wallet connected, showing empty canvas')
        setPixels(new Map())
        return
      }
      
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = getChromaContract(provider)
        
        const stats = await contract.getCanvasStats()
        setCanvasStats({
          totalPlaced: stats[0],
          canvasSize: stats[1]
        })
        
        // Load current viewport region
        const region = await contract.getCanvasRegion(
          viewportX, 
          viewportY, 
          VIEWPORT_WIDTH, 
          VIEWPORT_HEIGHT
        )
        const pixelMap = new Map<string, BackendPixel>()
        
        region.forEach((pixel: { owner: string; color: number; timestamp: bigint }, index: number) => {
          const x = viewportX + (index % VIEWPORT_WIDTH)
          const y = viewportY + Math.floor(index / VIEWPORT_WIDTH)
          if (pixel.color !== 0) {
            pixelMap.set(`${x},${y}`, {
              x,
              y,
              owner: pixel.owner,
              timestamp: new Date(Number(pixel.timestamp) * 1000),
              color: formatPixelColor(pixel.color),
              price: '0',
              transaction_hash: 'blockchain'
            })
          }
        })
        
        setPixels(pixelMap)
      } catch (blockchainError) {
        console.warn('Blockchain fallback failed:', blockchainError)
        setPixels(new Map())
      }
    } catch (error) {
      console.error('Error loading canvas data:', error)
      setPixels(new Map())
    }
  }, [viewportX, viewportY, publicClient])

  const loadUserStats = useCallback(async () => {
    try {
      if (!publicClient || !address) return
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = getChromaContract(provider)
      
      const userStats = await contract.getUserStats(address)
      setUserPixelCount(Number(userStats))
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }, [publicClient, address])

  const loadPixelPrice = useCallback(async (x: number, y: number) => {
    try {
      // Try backend first for cached prices
      try {
        const price = await chromaBackendService.getPixelPrice(x, y)
        setPixelPrice(price)
        return
      } catch {
        console.warn('Backend price unavailable, using blockchain')
      }
      
      // Fallback to blockchain if wallet is connected
      if (!publicClient) {
        console.log('No wallet connected, returning default price')
        setPixelPrice('0')
        return
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = getChromaContract(provider)
      
      const price = await contract.getPixelPrice(x, y)
      setPixelPrice(formatPrice(price))
    } catch (error) {
      console.error('Error loading pixel price:', error)
      setPixelPrice('0')
    }
  }, [publicClient])
  
  const loadGameStats = useCallback(async () => {
    try {
      const stats = await chromaBackendService.getGameStats()
      setGameStats(stats)
    } catch (error) {
      console.error('Error loading game stats:', error)
    }
  }, [])

  const loadLockPrice = useCallback(async (x: number, y: number) => {
    try {
      const price = await chromaBackendService.getLockPrice(x, y)
      setLockPrice(formatPrice(BigInt(price)))
    } catch (error) {
      console.error('Error loading lock price:', error)
      setLockPrice('0')
    }
  }, [])

  const loadUserCooldown = useCallback(async () => {
    if (!address) return
    
    try {
      const cooldown = await chromaBackendService.getUserCooldown(address)
      setUserCooldown(cooldown)
    } catch (error) {
      console.error('Error loading user cooldown:', error)
      setUserCooldown(null)
    }
  }, [address])

  // Load canvas data when viewport changes
  useEffect(() => {
    loadCanvasData()
  }, [viewportX, viewportY, loadCanvasData])
  
  // Keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Initialize backend service and real-time updates
  useEffect(() => {
    setIsBackendConnected(chromaBackendService.isSocketConnected())
    
    // Subscribe to pixel updates
    const unsubscribePixel = chromaBackendService.onPixelUpdate((pixel: BackendPixel) => {
      setPixels(prev => {
        const newPixels = new Map(prev)
        newPixels.set(`${pixel.x},${pixel.y}`, pixel)
        return newPixels
      })
      
      // Show notification for new pixels
      notificationService.pixelPlaced({ x: pixel.x, y: pixel.y }, pixel.color)
      
      // Trigger celebration if it's the user's pixel
      if (pixel.owner.toLowerCase() === address?.toLowerCase()) {
        celebrationService.pixelPlaced(pixel.x, pixel.y, pixel.color)
      }
    })
    
    // Subscribe to stats updates
    const unsubscribeStats = chromaBackendService.onStatsUpdate((stats: GameStatsResponse['data']) => {
      setGameStats(stats)
    })
    
    // Load initial data
    loadCanvasData()
    loadGameStats()
    
    return () => {
      unsubscribePixel()
      unsubscribeStats()
    }
  }, [address, loadCanvasData, loadGameStats])

  // Load user stats when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserStats()
    }
  }, [isConnected, address, loadUserStats])

  // Update pixel price and lock price when pixel is selected
  useEffect(() => {
    if (selectedPixel) {
      loadPixelPrice(selectedPixel.x, selectedPixel.y)
      loadLockPrice(selectedPixel.x, selectedPixel.y)
    }
  }, [selectedPixel, loadPixelPrice, loadLockPrice])

  // Load user cooldown when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserCooldown()
      // Refresh cooldown every 10 seconds
      const interval = setInterval(loadUserCooldown, 10000)
      return () => clearInterval(interval)
    }
  }, [isConnected, address, loadUserCooldown])

  const handlePixelClick = (x: number, y: number) => {
    if (!isConnected) {
      notificationService.walletConnectionError('Please connect your wallet to place pixels')
      return
    }
    const actualX = viewportX + x
    const actualY = viewportY + y
    setSelectedPixel({ x: actualX, y: actualY })
    
    // Track pixel selection
    analyticsService.trackFeatureUsed('pixel_selected', {
      coordinates: `${actualX},${actualY}`,
      hasExistingPixel: pixels.has(`${actualX},${actualY}`)
    })
  }

  const handlePlacePixel = async () => {
    if (!selectedPixel || !isConnected || !walletClient) {
      notificationService.walletConnectionError('Please connect your wallet to place pixels')
      return
    }

    setIsLoading(true)
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getChromaContract(signer)

      const colorValue = parsePixelColor(selectedColor)
      
      let tx
       if (isLockMode) {
         // Lock pixel mode
         const lockPriceWei = await contract.getLockPrice(selectedPixel.x, selectedPixel.y)
         
         tx = await contract.lockPixel(
           selectedPixel.x,
           selectedPixel.y,
           colorValue,
           { value: lockPriceWei }
         )
       } else {
         // Normal pixel placement
         const priceWei = await contract.getPixelPrice(selectedPixel.x, selectedPixel.y)
         
         tx = await contract.placePixel(
           selectedPixel.x,
           selectedPixel.y,
           colorValue,
           { value: priceWei }
         )
       }

      // Track transaction start
      analyticsService.trackTransactionStarted(tx.hash, isLockMode ? 'lock_pixel' : 'place_pixel', 'chroma')
      
      // Track transaction with notification service
      await transactionService.trackTransaction(
        `pixel-${selectedPixel.x}-${selectedPixel.y}`,
        Promise.resolve(tx.hash),
        {
          onSuccess: async () => {
             notificationService.pixelPlaced({ x: selectedPixel.x, y: selectedPixel.y }, selectedColor)
              celebrationService.pixelPlaced(selectedPixel.x, selectedPixel.y, selectedColor)
             
             // Track successful pixel placement
             analyticsService.trackPixelPlaced(
               selectedPixel.x, 
               selectedPixel.y, 
               selectedColor, 
               isLockMode ? lockPrice : pixelPrice
             )
             
             // Refresh canvas data
             await loadCanvasData()
             await loadGameStats()
             await loadUserStats()
             await loadUserCooldown()
             
             setSelectedPixel(null)
           },
          onError: (error) => {
            notificationService.error(notificationService.formatError(error as Error))
          },
          successMessage: isLockMode ? 'Pixel locked successfully!' : 'Pixel placed successfully!'
        }
      )
      
      // Wait for transaction confirmation
      await tx.wait()
      
    } catch (error: unknown) {
      console.error('Error placing/locking pixel:', error)
      notificationService.error(notificationService.formatError(error as Error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Game Header */}
      <div className="bg-primary/90 backdrop-blur-sm border-b border-accent-purple/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-gradient">Chroma Canvas</h1>
            <p className="text-gray-300 font-body">Collaborative onchain pixel art</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-accent-cyan">
              <Users className="w-5 h-5" />
              <span className="font-pixel">Live</span>
              <span className="font-body">on Base</span>
            </div>
            <div className="flex items-center space-x-2">
              {isBackendConnected ? (
                <Wifi className="w-4 h-4 text-accent-green" />
              ) : (
                <WifiOff className="w-4 h-4 text-accent-orange" />
              )}
              <span className="text-sm text-gray-400">
                {isBackendConnected ? 'Real-time' : 'Blockchain only'}
              </span>
            </div>
            <div className="text-accent-green font-pixel">
              {gameStats ? gameStats.totalPixels.toLocaleString() : 
               canvasStats ? Number(canvasStats.totalPlaced).toLocaleString() : '0'} pixels placed
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Canvas Area */}
        <div className="flex-1 relative bg-black/20">
          <motion.div 
            className="absolute inset-4 bg-gray-900 rounded-lg border border-accent-purple/30 overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Canvas Grid with Viewport */}
            <div className="w-full h-full relative">
              <div 
                className="grid gap-0 w-full h-full cursor-grab active:cursor-grabbing"
                style={{ 
                  gridTemplateColumns: `repeat(${VIEWPORT_WIDTH}, 1fr)`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {Array.from({ length: VIEWPORT_HEIGHT }, (_, y) =>
                  Array.from({ length: VIEWPORT_WIDTH }, (_, x) => {
                    const actualX = viewportX + x
                    const actualY = viewportY + y
                    const pixelKey = `${actualX},${actualY}`
                    const pixel = pixels.get(pixelKey)
                    const isSelected = selectedPixel?.x === actualX && selectedPixel?.y === actualY
                    
                    return (
                      <div
                        key={pixelKey}
                        className={`aspect-square border border-gray-700/30 cursor-crosshair transition-all duration-150 ${
                          isSelected ? 'ring-2 ring-accent-fuchsia' : 'hover:bg-white/10'
                        }`}
                        style={{ 
                          backgroundColor: pixel ? pixel.color : 'transparent'
                        }}
                        onClick={() => handlePixelClick(x, y)}
                        title={`Pixel (${actualX}, ${actualY})${pixel ? ` - ${pixel.color} by ${pixel.owner.slice(0, 6)}...` : ''}`}
                      />
                    )
                  })
                ).flat()}
              </div>
              
              {/* Viewport indicator */}
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Viewport: ({viewportX}, {viewportY}) - ({viewportX + VIEWPORT_WIDTH - 1}, {viewportY + VIEWPORT_HEIGHT - 1})
              </div>
              
              {/* Canvas overview minimap */}
              <div className="absolute bottom-2 right-2 w-20 h-20 bg-black/70 border border-purple-500/50 rounded">
                <div className="w-full h-full relative">
                  {/* Canvas bounds */}
                  <div className="w-full h-full bg-gray-800"></div>
                  {/* Current viewport indicator */}
                  <div 
                    className="absolute bg-purple-500/50 border border-purple-400"
                    style={{
                      left: `${(viewportX / CANVAS_WIDTH) * 100}%`,
                      top: `${(viewportY / CANVAS_HEIGHT) * 100}%`,
                      width: `${(VIEWPORT_WIDTH / CANVAS_WIDTH) * 100}%`,
                      height: `${(VIEWPORT_HEIGHT / CANVAS_HEIGHT) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Navigation and Zoom Controls */}
          <div className="absolute top-6 right-6 flex flex-col space-y-2">
            {/* Navigation Controls */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              <div></div>
              <button
                onClick={() => moveViewport(0, -10)}
                className="btn-secondary p-2"
                title="Move Up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div></div>
              <button
                onClick={() => moveViewport(-10, 0)}
                className="btn-secondary p-2"
                title="Move Left"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setViewportX(1400)
                  setViewportY(1400)
                }}
                className="btn-secondary p-2"
                title="Center"
              >
                <Navigation className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveViewport(10, 0)}
                className="btn-secondary p-2"
                title="Move Right"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <div></div>
              <button
                onClick={() => moveViewport(0, 10)}
                className="btn-secondary p-2"
                title="Move Down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <div></div>
            </div>
            
            {/* Zoom Controls */}
            <button
              onClick={() => setZoom(Math.min(zoom * 1.2, 3))}
              className="btn-secondary p-2"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={() => setZoom(Math.max(zoom / 1.2, 0.5))}
              className="btn-secondary p-2"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-primary/90 backdrop-blur-sm border-l border-accent-purple/30 p-6">
          {/* Color Picker */}
          <div className="mb-8">
            <h3 className="text-xl font-heading font-bold text-white mb-4 flex items-center">
              <Palette className="w-5 h-5 mr-2 text-accent-fuchsia" />
              Color Palette
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  className={`w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                    selectedColor === color 
                      ? 'border-accent-fuchsia scale-110' 
                      : 'border-gray-600 hover:border-accent-cyan'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full mt-4 h-12 rounded-lg border border-accent-purple/30 bg-transparent"
            />
          </div>

          {/* Pixel Info */}
          {selectedPixel && (
            <div className="mb-8">
              <h3 className="text-xl font-heading font-bold text-white mb-4 flex items-center">
                <Info className="w-5 h-5 mr-2 text-accent-cyan" />
                Pixel Info
              </h3>
              <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Coordinates:</span>
                  <span className="font-pixel text-accent-cyan">({selectedPixel.x}, {selectedPixel.y})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Price:</span>
                  <span className="font-pixel text-accent-green">{pixelPrice} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Lock Price:</span>
                  <span className="font-pixel text-accent-orange">{lockPrice} ETH</span>
                </div>
                {pixels.get(`${selectedPixel.x},${selectedPixel.y}`) && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Owner:</span>
                      <span className="font-pixel text-accent-cyan text-xs">
                        {pixels.get(`${selectedPixel.x},${selectedPixel.y}`)?.owner.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Placed:</span>
                      <span className="font-pixel text-accent-purple text-xs">
                        {new Date(pixels.get(`${selectedPixel.x},${selectedPixel.y}`)?.timestamp || 0).toLocaleTimeString()}
                      </span>
                    </div>
                    {pixels.get(`${selectedPixel.x},${selectedPixel.y}`)?.is_locked && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Locked Until:</span>
                        <span className="font-pixel text-accent-red text-xs">
                          {new Date(pixels.get(`${selectedPixel.x},${selectedPixel.y}`)?.locked_until || 0).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Lock Mode Toggle */}
          <div className="mb-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isLockMode}
                onChange={(e) => setIsLockMode(e.target.checked)}
                className="w-4 h-4 text-accent-purple bg-gray-700 border-gray-600 rounded focus:ring-accent-purple focus:ring-2"
              />
              <span className="text-white font-heading">
                Lock Mode {isLockMode ? '(50x price, 1 hour protection)' : ''}
              </span>
            </label>
          </div>

          {/* User Cooldown Display */}
          {userCooldown && !userCooldown.canPlace && (
            <div className="mb-4 p-3 bg-accent-orange/20 border border-accent-orange/30 rounded-lg">
              <div className="text-accent-orange font-heading text-sm">
                Cooldown: {Math.ceil(userCooldown.remainingTime)} seconds remaining
              </div>
            </div>
          )}

          {/* Place Pixel Button */}
          <button
            onClick={handlePlacePixel}
            disabled={!selectedPixel || !isConnected || isLoading || Boolean(userCooldown && !userCooldown.canPlace)}
            className={`w-full py-4 font-heading font-bold rounded-lg transition-all duration-300 ${
              selectedPixel && isConnected && !isLoading && (!userCooldown || userCooldown.canPlace)
                ? 'btn-primary'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (isLockMode ? 'Locking...' : 'Placing...') : 
             !isConnected ? 'Connect Wallet' : 
             !selectedPixel ? 'Select a Pixel' : 
             (userCooldown && !userCooldown.canPlace) ? 'On Cooldown' :
             isLockMode ? `Lock Pixel (${lockPrice} ETH)` : `Place Pixel (${pixelPrice} ETH)`}
          </button>

          {/* Navigation Instructions */}
          <div className="mt-8">
            <h3 className="text-xl font-heading font-bold text-white mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2 text-accent-cyan" />
              Navigation
            </h3>
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-2 text-sm text-gray-300">
              <p>• Use arrow keys to pan around</p>
              <p>• Drag the canvas to move viewport</p>
              <p>• Navigation buttons for precise movement</p>
              <p>• Minimap shows current position</p>
              <p>• Center button returns to middle</p>
            </div>
          </div>

          {/* Game Stats */}
          <div className="mt-8">
            <h3 className="text-xl font-heading font-bold text-white mb-4">
              Game Statistics
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Pixels:</span>
                <span className="font-pixel text-accent-fuchsia">
                  {gameStats ? gameStats.totalPixels.toLocaleString() : 
                   canvasStats ? Number(canvasStats.totalPlaced).toLocaleString() : '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Canvas Size:</span>
                <span className="font-pixel text-accent-cyan">3000x3000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Your Pixels:</span>
                <span className="font-pixel text-accent-green">{userPixelCount}</span>
              </div>
              {gameStats && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Revenue:</span>
                    <span className="font-pixel text-accent-orange">
                      {parseFloat(gameStats.totalRevenue).toFixed(4)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Artists:</span>
                    <span className="font-pixel text-accent-purple">{gameStats.uniqueArtists}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}