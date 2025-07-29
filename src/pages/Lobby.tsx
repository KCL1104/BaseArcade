import { motion } from 'framer-motion'
import { useEffect, useMemo } from 'react'
import { GameCard } from '../components/GameCard'
import { useGameRegistry } from '../hooks/useGameRegistry'
import { Gamepad2, Users, Activity, TrendingUp } from 'lucide-react'
import { analyticsService } from '../services/analyticsService'

export function Lobby() {
  const { games, isLoading, getTotalStats } = useGameRegistry()
  const totalStats = useMemo(() => getTotalStats(), [getTotalStats])
  
  // Track page view
  useEffect(() => {
    analyticsService.trackPageView('/')
  }, [])

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Enhanced Hero Section */}
      <motion.div 
        className="text-center mb-16 relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/10 via-accent-fuchsia/10 to-accent-cyan/10 blur-3xl -z-10" />
        
        <motion.div 
          className="flex items-center justify-center mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Gamepad2 className="w-16 h-16 text-accent-fuchsia mr-4" />
          <h1 className="text-6xl md:text-8xl font-heading font-black text-gradient">
            Base Arcade
          </h1>
        </motion.div>
        
        <motion.h2 
          className="text-3xl md:text-4xl font-heading font-bold text-white mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Choose Your Adventure
        </motion.h2>
        
        <motion.p 
          className="text-xl md:text-2xl text-gray-300 font-body max-w-3xl mx-auto mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          Where classic gaming meets onchain innovation. Join thousands of players in our 
          decentralized arcade experience on Base blockchain.
        </motion.p>
        
        {/* Live platform stats in hero */}
        <motion.div 
          className="flex items-center justify-center space-x-8 text-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-accent-green" />
            <span className="text-gray-300">{totalStats.activePlayers} playing now</span>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-accent-fuchsia" />
            <span className="text-gray-300">{totalStats.totalTransactions.toLocaleString()} total plays</span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-accent-cyan" />
            <span className="text-gray-300">{games.filter(g => g.status === 'active').length} games live</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Games Grid */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, index) => (
            <div 
              key={index}
              className="game-card animate-pulse"
            >
              <div className="h-48 bg-gray-700 rounded-lg mb-4"></div>
              <div className="h-6 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-700 rounded mb-4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            </div>
          ))
        ) : (
          games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <GameCard game={game} />
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Enhanced Platform Statistics */}
      <motion.div 
        className="mt-20 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <motion.h2 
          className="text-4xl font-heading font-bold text-gradient mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          Platform Statistics
        </motion.h2>
        <motion.p 
          className="text-gray-400 font-body mb-12 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          Real-time metrics from our thriving onchain gaming community
        </motion.p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {/* Active Players */}
          <motion.div 
            className="bg-gradient-to-br from-accent-green/20 to-accent-green/5 border border-accent-green/30 rounded-xl p-6 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(34, 197, 94, 0.3)" }}
          >
            <div className="absolute top-4 right-4">
              <Users className="w-6 h-6 text-accent-green/50" />
            </div>
            <div className="text-3xl font-pixel font-bold text-accent-green mb-2">
              {totalStats.activePlayers}
            </div>
            <div className="text-gray-300 font-body text-sm">
              Players Online
            </div>
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse mr-2" />
              <span className="text-xs text-accent-green">Live</span>
            </div>
          </motion.div>
          
          {/* Total Players */}
          <motion.div 
            className="bg-gradient-to-br from-accent-fuchsia/20 to-accent-fuchsia/5 border border-accent-fuchsia/30 rounded-xl p-6 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(217, 70, 239, 0.3)" }}
          >
            <div className="absolute top-4 right-4">
              <TrendingUp className="w-6 h-6 text-accent-fuchsia/50" />
            </div>
            <div className="text-3xl font-pixel font-bold text-accent-fuchsia mb-2">
              {totalStats.totalPlayers.toLocaleString()}
            </div>
            <div className="text-gray-300 font-body text-sm">
              Total Players
            </div>
            <div className="text-xs text-accent-fuchsia mt-2">
              All-time registered
            </div>
          </motion.div>
          
          {/* Total Transactions */}
          <motion.div 
            className="bg-gradient-to-br from-accent-cyan/20 to-accent-cyan/5 border border-accent-cyan/30 rounded-xl p-6 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.6 }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(6, 182, 212, 0.3)" }}
          >
            <div className="absolute top-4 right-4">
              <Activity className="w-6 h-6 text-accent-cyan/50" />
            </div>
            <div className="text-3xl font-pixel font-bold text-accent-cyan mb-2">
              {totalStats.totalTransactions.toLocaleString()}
            </div>
            <div className="text-gray-300 font-body text-sm">
              Game Transactions
            </div>
            <div className="text-xs text-accent-cyan mt-2">
              Onchain interactions
            </div>
          </motion.div>
          
          {/* Games Available */}
          <motion.div 
            className="bg-gradient-to-br from-accent-purple/20 to-accent-purple/5 border border-accent-purple/30 rounded-xl p-6 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.8 }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(168, 85, 247, 0.3)" }}
          >
            <div className="absolute top-4 right-4">
              <Gamepad2 className="w-6 h-6 text-accent-purple/50" />
            </div>
            <div className="text-3xl font-pixel font-bold text-accent-purple mb-2">
              {games.filter(g => g.status === 'active').length}
            </div>
            <div className="text-gray-300 font-body text-sm">
              Games Live
            </div>
            <div className="text-xs text-accent-purple mt-2">
              {games.filter(g => g.status === 'coming_soon').length} more coming
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.footer 
        className="mt-20 text-center text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <p className="font-body">
          Built on Base • Powered by Web3 • Made with ❤️ for the onchain gaming community
        </p>
      </motion.footer>
    </div>
  )
}