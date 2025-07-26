import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Play, Users, Activity, TrendingUp, Zap } from 'lucide-react'
import type { Game } from '../types/game'
import { analyticsService } from '../services/analyticsService'

interface GameCardProps {
  game: Game
}

export function GameCard({ game }: GameCardProps) {
  const isComingSoon = game.status === 'coming_soon'
  const isMaintenance = game.status === 'maintenance'
  const isAvailable = game.status === 'active'
  
  const handleGameClick = () => {
    if (isAvailable) {
      analyticsService.trackFeatureUsed('game_card_clicked', {
        gameId: game.id,
        gameName: game.name,
        activePlayers: game.stats?.activePlayers || 0
      })
    }
  }

  const CardContent = () => (
    <motion.div 
      className="game-card h-full flex flex-col relative overflow-hidden"
      whileHover={{ 
        boxShadow: isAvailable ? "0 0 30px rgba(168, 85, 247, 0.4)" : undefined,
        scale: isAvailable ? 1.02 : 1
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Neon glow effect */}
      {isAvailable && (
        <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/10 via-accent-fuchsia/10 to-accent-cyan/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}
      
      {/* Game Illustration */}
      <div className="relative mb-6 h-48 rounded-lg overflow-hidden bg-gradient-to-br from-accent-purple/20 to-accent-fuchsia/20 flex items-center justify-center">
        {game.illustration ? (
          <img 
            src={game.illustration} 
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="text-6xl transition-transform duration-300 group-hover:scale-110">{game.emoji}</div>
        )}
        
        {/* Live Activity Indicator */}
        {isAvailable && game.stats && (
          <div className="absolute top-3 left-3 flex items-center space-x-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
            <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <span className="text-xs text-white font-pixel">{game.stats.activePlayers}</span>
          </div>
        )}
        
        {/* Status Badge */}
        {!isAvailable && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-heading font-bold">
            {isComingSoon && (
              <span className="bg-accent-orange text-white shadow-lg">Coming Soon</span>
            )}
            {isMaintenance && (
              <span className="bg-accent-red text-white shadow-lg">Maintenance</span>
            )}
          </div>
        )}
        
        {/* Play Button Overlay */}
        {isAvailable && (
          <motion.div 
            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            whileHover={{ scale: 1.05 }}
          >
            <motion.div 
              className="bg-gradient-to-r from-accent-fuchsia to-accent-purple text-white rounded-full p-4 shadow-2xl"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Play className="w-8 h-8 fill-current" />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Game Info */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-2xl font-heading font-bold text-white mb-2">
          {game.name}
        </h3>
        
        <p className="text-gray-300 font-body mb-4 flex-1">
          {game.description}
        </p>

        {/* Enhanced Live Stats */}
        {game.stats && isAvailable && (
          <div className="space-y-3 mb-4">
            {/* Active Players */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-accent-green/20 rounded">
                  <Users className="w-3 h-3 text-accent-green" />
                </div>
                <span className="text-sm text-gray-300 font-body">Active Players</span>
              </div>
              <span className="font-pixel text-accent-green font-bold">{game.stats.activePlayers || 0}</span>
            </div>
            
            {/* Live Metric */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-accent-fuchsia/20 rounded">
                  <Activity className="w-3 h-3 text-accent-fuchsia" />
                </div>
                <span className="text-sm text-gray-300 font-body">Activity</span>
              </div>
              <span className="font-pixel text-accent-fuchsia font-bold text-xs">{game.stats.liveMetric}</span>
            </div>
            
            {/* Total Players */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-accent-cyan/20 rounded">
                  <TrendingUp className="w-3 h-3 text-accent-cyan" />
                </div>
                <span className="text-sm text-gray-300 font-body">Total Players</span>
              </div>
              <span className="font-pixel text-accent-cyan font-bold">{game.stats.totalPlayers?.toLocaleString() || 0}</span>
            </div>
          </div>
        )}

        {/* Enhanced Action Button */}
        <div className="mt-auto">
          {isAvailable && (
            <motion.div 
              className="btn-primary w-full text-center py-3 font-heading font-bold relative overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="relative z-10">Play Now</span>
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-accent-fuchsia to-accent-purple opacity-0"
                whileHover={{ opacity: 0.2 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          )}
          {isComingSoon && (
            <div className="btn-secondary w-full text-center py-3 font-heading font-bold opacity-50 cursor-not-allowed bg-gradient-to-r from-accent-orange/20 to-accent-orange/10 border-accent-orange/30">
              <div className="flex items-center justify-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Coming Soon</span>
              </div>
            </div>
          )}
          {isMaintenance && (
            <div className="btn-secondary w-full text-center py-3 font-heading font-bold opacity-50 cursor-not-allowed border-accent-red text-accent-red bg-accent-red/10">
              Under Maintenance
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )

  if (isAvailable) {
    // Map game IDs to actual routes
    const gameRoutes: Record<string, string> = {
      'chroma': '/chroma',
      'fountain': '/fountain',
      'pixel-wars': '/pixel-wars'
    }
    
    const gameRoute = gameRoutes[game.id] || `/game/${game.id}`
    
    return (
      <Link to={gameRoute} className="block group" onClick={handleGameClick}>
        <motion.div
          whileHover={{ y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <CardContent />
        </motion.div>
      </Link>
    )
  }

  return (
    <div className="group cursor-not-allowed">
      <CardContent />
    </div>
  )
}