import express from 'express';
import { gameActionLimiter } from '../middleware/rateLimiter';
import {
  validatePixelPlacement,
  validatePixelLock,
  validateUserStatsRequest,
  validatePagination,
  handleValidationErrors,
  validateBusinessRules,
  validateUserCooldown
} from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import ChromaService from '../services/chromaService';

const router = express.Router();

// Lazy initialize chroma service
let chromaService: ChromaService | null = null;
const getChromaService = (): ChromaService => {
  if (!chromaService) {
    chromaService = new ChromaService();
  }
  return chromaService;
};

// Get canvas region
router.get('/canvas', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const startX = parseInt(req.query.startX as string) || 0;
    const startY = parseInt(req.query.startY as string) || 0;
    const width = parseInt(req.query.width as string) || 100;
    const height = parseInt(req.query.height as string) || 100;
    
    // Validate parameters
    if (startX < 0 || startY < 0 || width <= 0 || height <= 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid canvas region parameters',
          code: 'INVALID_PARAMETERS'
        }
      });
      return;
    }
    
    if (width > 1000 || height > 1000) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Canvas region too large (max 1000x1000)',
          code: 'REGION_TOO_LARGE'
        }
      });
      return;
    }
    
    // Validate canvas bounds
    if (startX >= 3000 || startY >= 3000 || startX + width > 3000 || startY + height > 3000) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Canvas region exceeds canvas bounds (3000x3000)',
          code: 'OUT_OF_BOUNDS'
        }
      });
      return;
    }
    
    const canvasData = await getChromaService().getCanvasRegion(startX, startY, width, height);
    res.json({
      success: true,
      data: canvasData
    });
  })
);

// Get game statistics
router.get('/stats', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const stats = await getChromaService().getCanvasStats();
    res.json({
      success: true,
      data: stats
    });
  })
);

// Get pixel price
router.get('/pixel/:x/:y/price', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);
    
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x >= 3000 || y >= 3000) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid coordinates (must be 0-2999)',
          code: 'INVALID_COORDINATES'
        }
      });
      return;
    }
    
    const price = await getChromaService().getPixelPrice(x, y);
    res.json({
      success: true,
      data: {
        coordinates: { x, y },
        price
      }
    });
  })
);

// Get lock price for a pixel
router.get('/pixel/:x/:y/lock-price', 
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);
    
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x >= 3000 || y >= 3000) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid coordinates (must be 0-2999)',
          code: 'INVALID_COORDINATES'
        }
      });
      return;
    }
    
    const lockPrice = await getChromaService().getLockPrice(x, y);
    res.json({
      success: true,
      data: {
        coordinates: { x, y },
        lockPrice
      }
    });
  })
);

// Get user cooldown status
router.get('/users/:address/cooldown', 
  validateUserStatsRequest(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const address = req.params.address;
    
    const cooldown = await getChromaService().getUserCooldown(address);
    res.json({
      success: true,
      data: cooldown
    });
  })
);

// Get locked pixels
router.get('/locked-pixels', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const lockedPixels = await getChromaService().getLockedPixels(limit, offset);
    res.json({
      success: true,
      data: lockedPixels,
      pagination: {
        limit,
        offset,
        count: lockedPixels.length
      }
    });
  })
);

// Place pixel (with security middleware)
router.post('/pixels', 
  gameActionLimiter, // Rate limiting for game actions
  validatePixelPlacement(),
  handleValidationErrors,
  validateBusinessRules(),
  validateUserCooldown(),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { x, y, color, transactionHash, address, gasUsed, gasPrice } = req.body;
    
    const result = await getChromaService().placePixel({
      x,
      y,
      color,
      transactionHash,
      address,
      gasUsed,
      gasPrice
    });
    
    res.json({
      success: true,
      data: result
    });
  })
);

// Lock pixel (with security middleware)
router.post('/pixels/lock', 
  gameActionLimiter, // Rate limiting for game actions
  validatePixelLock(),
  handleValidationErrors,
  validateBusinessRules(),
  validateUserCooldown(),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { x, y, color, transactionHash, address, lockDuration } = req.body;
    
    const result = await getChromaService().lockPixel({
      x,
      y,
      color,
      transactionHash,
      address,
      lockDuration: lockDuration || 3600 // Default 1 hour
    });
    
    res.json({
      success: true,
      data: result
    });
  })
);

// Get user statistics
router.get('/users/:address/stats', 
  validateUserStatsRequest(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const address = req.params.address;
    
    const stats = await getChromaService().getUserStats(address);
    res.json({
      success: true,
      data: stats
    });
  })
);

// Get user pixel history
router.get('/users/:address/pixels', 
  validateUserStatsRequest(),
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const address = req.params.address;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const pixels = await getChromaService().getUserPixels(address, limit, offset);
    res.json({
      success: true,
      data: pixels,
      pagination: {
        limit,
        offset,
        count: pixels.length
      }
    });
  })
);

// Get recent pixel placements
router.get('/recent-pixels', 
  validatePagination(),
  handleValidationErrors,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const recentPixels = await getChromaService().getRecentPixels(limit, offset);
    res.json({
      success: true,
      data: recentPixels,
      pagination: {
        limit,
        offset,
        count: recentPixels.length
      }
    });
  })
);

// Health check for chroma service
router.get('/health', 
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const health = await getChromaService().getHealthStatus();
    res.json({
      success: true,
      data: health
    });
  })
);

// Export the service getter for WebSocket integration
export const getChromaServiceInstance = getChromaService;
export default router;