import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/databaseService';
import { BlockchainService } from '../services/blockchainService';
import { SocketService } from '../services/socketService';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// We'll inject these services when the app starts
let databaseService: DatabaseService;
let blockchainService: BlockchainService;
let socketService: SocketService;

// Initialize services (called from main app)
export const initializeGameStatsController = (
  db: DatabaseService,
  blockchain: BlockchainService,
  socket: SocketService
) => {
  databaseService = db;
  blockchainService = blockchain;
  socketService = socket;
};

// GET /api/game-stats - Get overall game statistics
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await databaseService.getGameStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting game stats:', error);
    throw createError('Failed to get game stats', 500);
  }
}));

// GET /api/game-stats/summary - Get summarized statistics
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await databaseService.getGameStats();
    
    // Create a simplified summary
    const summary = {
      totalPixels: stats.totalPixelsPlaced,
      totalRevenue: parseFloat(stats.totalRevenue).toFixed(4),
      uniqueArtists: stats.uniqueArtists,
      averagePrice: parseFloat(stats.averagePixelPrice).toFixed(6),
      recentActivity: stats.recentActivity.count,
      mostExpensive: stats.mostExpensivePixel ? {
        coordinates: `(${stats.mostExpensivePixel.x}, ${stats.mostExpensivePixel.y})`,
        price: parseFloat(stats.mostExpensivePixel.price).toFixed(6)
      } : null
    };
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting game stats summary:', error);
    throw createError('Failed to get game stats summary', 500);
  }
}));

// GET /api/game-stats/leaderboard - Get top artists/contributors
router.get('/leaderboard', asyncHandler(async (req: Request, res: Response) => {
  const { limit, type } = req.query;
  const resultLimit = limit ? parseInt(limit as string) : 10;
  const leaderboardType = type as string || 'pixels'; // 'pixels' or 'revenue'

  if (isNaN(resultLimit) || resultLimit <= 0 || resultLimit > 50) {
    throw createError('Invalid limit: must be a number between 1 and 50', 400);
  }

  if (!['pixels', 'revenue'].includes(leaderboardType)) {
    throw createError('Invalid type: must be "pixels" or "revenue"', 400);
  }

  try {
    // This would require more complex database queries
    // For now, return a placeholder response
    const leaderboard = {
      type: leaderboardType,
      limit: resultLimit,
      entries: [], // TODO: Implement actual leaderboard queries
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    throw createError('Failed to get leaderboard', 500);
  }
}));

// GET /api/game-stats/activity - Get activity statistics
router.get('/activity', asyncHandler(async (req: Request, res: Response) => {
  const { timeframe } = req.query;
  const period = timeframe as string || '24h';

  if (!['1h', '6h', '24h', '7d', '30d'].includes(period)) {
    throw createError('Invalid timeframe: must be one of 1h, 6h, 24h, 7d, 30d', 400);
  }

  try {
    // Calculate time range
    const now = new Date();
    let startTime: Date;
    
    switch (period) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get recent pixels for the timeframe
    const recentPixels = await databaseService.getRecentPixels(1000); // Get more to filter
    const filteredPixels = recentPixels.filter(pixel => pixel.timestamp >= startTime);
    
    // Calculate activity metrics
    const uniqueArtists = new Set(filteredPixels.map(p => p.owner)).size;
    const totalRevenue = filteredPixels.reduce((sum, p) => sum + parseFloat(p.price), 0);
    const averagePrice = filteredPixels.length > 0 ? totalRevenue / filteredPixels.length : 0;
    
    const activity = {
      timeframe: period,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      metrics: {
        totalPixels: filteredPixels.length,
        uniqueArtists,
        totalRevenue: totalRevenue.toString(),
        averagePrice: averagePrice.toString(),
        pixelsPerHour: period === '1h' ? filteredPixels.length : 
                      filteredPixels.length / (parseInt(period.replace(/[^0-9]/g, '')) || 24)
      },
      recentPixels: filteredPixels.slice(0, 20) // Return latest 20 for display
    };
    
    res.json({
      success: true,
      data: activity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting activity stats:', error);
    throw createError('Failed to get activity stats', 500);
  }
}));

// GET /api/game-stats/realtime - Get real-time connection statistics
router.get('/realtime', asyncHandler(async (req: Request, res: Response) => {
  try {
    const connectedClients = socketService?.getConnectedClientsCount() || 0;
    const canvasRoomSize = await socketService?.getCanvasRoomSize() || 0;
    const isBlockchainListening = blockchainService?.isEventListening() || false;
    const latestBlock = await blockchainService?.getLatestBlockNumber();
    
    const realtimeStats = {
      connections: {
        total: connectedClients,
        canvasRoom: canvasRoomSize
      },
      blockchain: {
        isListening: isBlockchainListening,
        latestBlock,
        contractAddress: process.env.CHROMA_CONTRACT_ADDRESS
      },
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };
    
    res.json({
      success: true,
      data: realtimeStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting realtime stats:', error);
    throw createError('Failed to get realtime stats', 500);
  }
}));

// GET /api/game-stats/health - Health check with detailed status
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      services: {
        database: {
          status: 'connected',
          lastCheck: new Date().toISOString()
        },
        blockchain: {
          status: blockchainService?.isEventListening() ? 'connected' : 'disconnected',
          isListening: blockchainService?.isEventListening() || false,
          lastBlock: await blockchainService?.getLatestBlockNumber()
        },
        websocket: {
          status: 'active',
          connections: socketService?.getConnectedClientsCount() || 0
        }
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Error getting health status:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: 'Service health check failed',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

export { router as gameStatsRouter };