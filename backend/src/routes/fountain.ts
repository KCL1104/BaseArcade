import express from 'express';
import { gameActionLimiter } from '../middleware/rateLimiter';
import {
  validateCoinToss,
  validateUserStatsRequest,
  validatePagination,
  validateRoundId,
  handleValidationErrors,
  validateBusinessRules
} from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import FountainService from '../services/fountainService';

const router = express.Router();

// Lazy initialize fountain service
let fountainService: FountainService | null = null;
const getFountainService = (): FountainService => {
  if (!fountainService) {
    fountainService = new FountainService();
  }
  return fountainService;
};

// Get current round information
router.get('/current-round', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const currentRound = await getFountainService().getCurrentRound();
    res.json({
      success: true,
      data: currentRound
    });
    return;
  })
);

// Get game statistics
router.get('/stats', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const stats = await getFountainService().getGameStats();
    res.json({
      success: true,
      data: stats
    });
    return;
  })
);

// Get round history
router.get('/rounds', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const rounds = await getFountainService().getRoundHistory(limit, offset);
    res.json({
      success: true,
      data: rounds,
      pagination: {
        limit,
        offset,
        count: rounds.length
      }
    });
    return;
  })
);

// Get specific round information
router.get('/rounds/:roundId', 
  validateRoundId(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const roundId = parseInt(req.params.roundId);
    
    const participants = await getFountainService().getRoundParticipants(roundId);
    res.json({
      success: true,
      data: {
        roundId,
        participants
      }
    });
    return;
  })
);

// Get user statistics
router.get('/users/:address/stats', 
  validateUserStatsRequest(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const address = req.params.address;
    
    const userStats = await getFountainService().getUserStats(address);
    res.json({
      success: true,
      data: userStats
    });
    return;
  })
);

// Get user participation history
router.get('/users/:address/history', 
  validateUserStatsRequest(),
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const address = req.params.address;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Get user's participation history from database
    const { data, error } = await getFountainService().supabase
      .from('fountain_tosses')
      .select(`
        round_id,
        entry_fee,
        timestamp,
        transaction_hash,
        fountain_rounds!inner(
          start_time,
          end_time,
          prize_pool,
          winner_address,
          is_complete
        )
      `)
      .eq('participant_address', address.toLowerCase())
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || [],
      pagination: {
        limit,
        offset,
        count: data ? data.length : 0
      }
    });
    return;
  })
);

// Get accumulated rollover amount
router.get('/rollover', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const rollover = await getFountainService().getAccumulatedRollover();
    res.json({
      success: true,
      data: { accumulatedRollover: rollover }
    });
    return;
  })
);

// Get current prize breakdown
router.get('/prize-breakdown', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const breakdown = await getFountainService().getCurrentPrizeBreakdown();
    res.json({
      success: true,
      data: breakdown
    });
    return;
  })
);

// Get Chroma fees history
router.get('/chroma-fees', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const roundId = req.query.roundId ? parseInt(req.query.roundId as string) : null;
    
    // Additional validation for roundId
    if (roundId !== null && (isNaN(roundId) || roundId < 0)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid round ID',
          code: 'INVALID_ROUND_ID'
        }
      });
      return;
    }
    
    const chromaFees = await getFountainService().getChromaFees(roundId as number, limit, offset);
    res.json({
      success: true,
      data: chromaFees,
      pagination: {
        limit,
        offset,
        count: chromaFees.length,
        roundId
      }
    });
    return;
  })
);

// Get rollover history
router.get('/rollover-history', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const rolloverHistory = await getFountainService().getRolloverHistory(limit, offset);
    res.json({
      success: true,
      data: rolloverHistory,
      pagination: {
        limit,
        offset,
        count: rolloverHistory.length
      }
    });
    return;
  })
);

// Get recent winners
router.get('/winners', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const { data, error } = await getFountainService().supabase
      .from('fountain_winners')
      .select(`
        round_id,
        winner_address,
        prize_amount,
        timestamp,
        transaction_hash
      `)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || [],
      pagination: {
        limit,
        offset,
        count: data ? data.length : 0
      }
    });
    return;
  })
);

// Coin toss endpoint (with security middleware)
router.post('/toss', 
  gameActionLimiter, // Rate limiting for game actions
  validateCoinToss(),
  handleValidationErrors,
  validateBusinessRules(),
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const { address, entryFee, transactionHash, gasUsed, gasPrice } = req.body;
    
    const result = await getFountainService().processCoinToss({
      address,
      entryFee,
      transactionHash,
      gasUsed,
      gasPrice
    });
    
    res.json({
      success: true,
      data: result
    });
    return;
  })
);

// Get user's current round participation status
router.get('/users/:address/current-participation', 
  validateUserStatsRequest(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const address = req.params.address;
    
    const participation = await getFountainService().getCurrentParticipation(address);
    res.json({
      success: true,
      data: participation
    });
    return;
  })
);

// Get leaderboard
router.get('/leaderboard', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const timeframe = req.query.timeframe as string || 'all'; // all, week, month
    
    // Validate timeframe
    if (!['all', 'week', 'month'].includes(timeframe)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid timeframe (must be: all, week, month)',
          code: 'INVALID_TIMEFRAME'
        }
      });
      return;
    }
    
    const leaderboard = await getFountainService().getLeaderboard(timeframe, limit, offset);
    res.json({
      success: true,
      data: leaderboard,
      pagination: {
        limit,
        offset,
        count: leaderboard.length,
        timeframe
      }
    });
    return;
  })
);

// Health check endpoint
router.get('/health', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    // Check if contract is accessible
    let contractStatus = 'disconnected';
    try {
      const contract = getFountainService().contract;
      if (contract) {
        await contract.currentRoundId();
        contractStatus = 'connected';
      }
    } catch (error) {
      console.error('Contract health check failed:', error);
    }
    
    // Check database connection
    let dbStatus = 'disconnected';
    try {
      const { error } = await getFountainService().supabase
        .from('fountain_rounds')
        .select('count')
        .limit(1);
      
      if (!error) {
        dbStatus = 'connected';
      }
    } catch (error) {
      console.error('Database health check failed:', error);
    }
    
    res.json({
      success: true,
      data: {
        service: 'fountain',
        status: 'running',
        contract: contractStatus,
        database: dbStatus,
        websocketClients: getFountainService().wsClients.size,
        timestamp: new Date().toISOString()
      }
    });
    return;
  })
);

// Export fountain service for WebSocket usage
export const getFountainServiceInstance = getFountainService;
export default router;