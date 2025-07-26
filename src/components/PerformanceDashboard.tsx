import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Activity, Cpu, HardDrive, Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import { performanceService, usePerformanceMonitoring } from '../services/performanceService'
import { cacheService } from '../services/cacheService'

interface PerformanceStats {
  frameRate: number
  memoryUsage: number
  renderTime: number
  networkTime: number
  cacheHitRate: number
  recommendations: string[]
}

export const PerformanceDashboard: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    frameRate: 0,
    memoryUsage: 0,
    renderTime: 0,
    networkTime: 0,
    cacheHitRate: 0,
    recommendations: []
  })
  const [isVisible, setIsVisible] = useState(false)
  const { getReport, exportData } = usePerformanceMonitoring()

  useEffect(() => {
    const updateStats = () => {
      try {
        const report = getReport()
        const cacheStats = cacheService.getStats()
        
        setStats({
          frameRate: Math.round(report.summary.frameRate),
          memoryUsage: Math.round(report.summary.memoryUsage),
          renderTime: Math.round(report.summary.averageRenderTime * 100) / 100,
          networkTime: Math.round(report.summary.averageNetworkTime),
          cacheHitRate: Math.round(cacheStats.hitRate * 100),
          recommendations: report.recommendations
        })
      } catch (error) {
        console.warn('Performance stats update failed:', error)
      }
    }

    // Update stats every 2 seconds
    const interval = setInterval(updateStats, 2000)
    updateStats() // Initial update

    return () => clearInterval(interval)
  }, [])

  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-400'
    if (value >= thresholds.warning) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getMemoryColor = (usage: number) => {
    if (usage < 50) return 'text-green-400'
    if (usage < 100) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getRenderTimeColor = (time: number) => {
    if (time < 8) return 'text-green-400'
    if (time < 16) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (!isVisible) {
    return (
      <motion.button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Activity className="w-5 h-5" />
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 w-80 z-50"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          Performance
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        {/* Frame Rate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">FPS</span>
          </div>
          <span className={`text-sm font-mono ${getPerformanceColor(stats.frameRate, { good: 50, warning: 30 })}`}>
            {stats.frameRate}
          </span>
        </div>

        {/* Memory Usage */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Memory</span>
          </div>
          <span className={`text-sm font-mono ${getMemoryColor(stats.memoryUsage)}`}>
            {stats.memoryUsage}MB
          </span>
        </div>

        {/* Render Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-gray-300">Render</span>
          </div>
          <span className={`text-sm font-mono ${getRenderTimeColor(stats.renderTime)}`}>
            {stats.renderTime}ms
          </span>
        </div>

        {/* Network Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-gray-300">Network</span>
          </div>
          <span className={`text-sm font-mono ${getPerformanceColor(1000 - stats.networkTime, { good: 800, warning: 500 })}`}>
            {stats.networkTime}ms
          </span>
        </div>

        {/* Cache Hit Rate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-300">Cache</span>
          </div>
          <span className={`text-sm font-mono ${getPerformanceColor(stats.cacheHitRate, { good: 80, warning: 60 })}`}>
            {stats.cacheHitRate}%
          </span>
        </div>
      </div>

      {/* Recommendations */}
      {stats.recommendations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-gray-300">Recommendations</span>
          </div>
          <div className="space-y-1">
            {stats.recommendations.slice(0, 2).map((rec, index) => (
              <p key={index} className="text-xs text-gray-400 leading-relaxed">
                {rec}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-gray-700 flex gap-2">
        <button
          onClick={exportData}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 px-3 rounded transition-colors"
        >
          Export Data
        </button>
        <button
          onClick={() => {
            performanceService.clearMetrics()
            cacheService.clear()
          }}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded transition-colors"
        >
          Clear Cache
        </button>
      </div>

      {/* Performance Indicators */}
      <div className="mt-3 flex gap-1">
        <div className={`h-1 flex-1 rounded ${stats.frameRate > 50 ? 'bg-green-400' : stats.frameRate > 30 ? 'bg-yellow-400' : 'bg-red-400'}`} />
        <div className={`h-1 flex-1 rounded ${stats.memoryUsage < 50 ? 'bg-green-400' : stats.memoryUsage < 100 ? 'bg-yellow-400' : 'bg-red-400'}`} />
        <div className={`h-1 flex-1 rounded ${stats.renderTime < 8 ? 'bg-green-400' : stats.renderTime < 16 ? 'bg-yellow-400' : 'bg-red-400'}`} />
        <div className={`h-1 flex-1 rounded ${stats.cacheHitRate > 80 ? 'bg-green-400' : stats.cacheHitRate > 60 ? 'bg-yellow-400' : 'bg-red-400'}`} />
      </div>
    </motion.div>
  )
}

export default PerformanceDashboard