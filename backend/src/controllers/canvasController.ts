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
export const initializeCanvasController = (
  db: DatabaseService,
  blockchain: BlockchainService,
  socket: SocketService
) => {
  databaseService = db;
  blockchainService = blockchain;
  socketService = socket;
};

// GET /api/canvas/region - Get pixels in a specific region
router.get('/region', asyncHandler(async (req: Request, res: Response) => {
  const { x, y, width, height } = req.query;

  // Validate parameters
  if (!x || !y || !width || !height) {
    throw createError('Missing required parameters: x, y, width, height', 400);
  }

  const regionX = parseInt(x as string);
  const regionY = parseInt(y as string);
  const regionWidth = parseInt(width as string);
  const regionHeight = parseInt(height as string);

  if (isNaN(regionX) || isNaN(regionY) || isNaN(regionWidth) || isNaN(regionHeight)) {
    throw createError('Invalid parameters: x, y, width, height must be numbers', 400);
  }

  // Validate region bounds
  if (regionWidth > 1000 || regionHeight > 1000) {
    throw createError('Region too large: maximum 1000x1000 pixels', 400);
  }

  if (regionX < 0 || regionY < 0 || regionWidth <= 0 || regionHeight <= 0) {
    throw createError('Invalid region: coordinates and dimensions must be positive', 400);
  }

  try {
    const pixels = await databaseService.getCanvasRegion(regionX, regionY, regionWidth, regionHeight);
    
    res.json({
      success: true,
      data: {
        pixels,
        region: {
          x: regionX,
          y: regionY,
          width: regionWidth,
          height: regionHeight
        },
        count: pixels.length
      }
    });
  } catch (error) {
    logger.error('Error getting canvas region:', error);
    throw createError('Failed to get canvas region', 500);
  }
}));

// GET /api/canvas/pixel/:x/:y - Get specific pixel
router.get('/pixel/:x/:y', asyncHandler(async (req: Request, res: Response) => {
  const { x, y } = req.params;

  const pixelX = parseInt(x);
  const pixelY = parseInt(y);

  if (isNaN(pixelX) || isNaN(pixelY)) {
    throw createError('Invalid coordinates: x and y must be numbers', 400);
  }

  try {
    // Try to get from database first
    let pixel = await databaseService.getPixel(pixelX, pixelY);
    
    // If not in database, try to get from blockchain
    if (!pixel && blockchainService) {
      const contractPixel = await blockchainService.getPixel(pixelX, pixelY);
      if (contractPixel && contractPixel.color !== '') {
        // Save to database for future queries
        pixel = await databaseService.savePixel({
          x: pixelX,
          y: pixelY,
          color: contractPixel.color,
          owner: contractPixel.owner,
          price: contractPixel.price,
          timestamp: new Date(),
          transaction_hash: 'sync'
        });
      }
    }

    res.json({
      success: true,
      data: {
        pixel: pixel || null,
        coordinates: { x: pixelX, y: pixelY }
      }
    });
  } catch (error) {
    logger.error(`Error getting pixel (${pixelX}, ${pixelY}):`, error);
    throw createError('Failed to get pixel', 500);
  }
}));

// GET /api/canvas/recent - Get recent pixel changes
router.get('/recent', asyncHandler(async (req: Request, res: Response) => {
  const { limit } = req.query;
  const pixelLimit = limit ? parseInt(limit as string) : 50;

  if (isNaN(pixelLimit) || pixelLimit <= 0 || pixelLimit > 200) {
    throw createError('Invalid limit: must be a number between 1 and 200', 400);
  }

  try {
    const pixels = await databaseService.getRecentPixels(pixelLimit);
    
    res.json({
      success: true,
      data: {
        pixels,
        count: pixels.length,
        limit: pixelLimit
      }
    });
  } catch (error) {
    logger.error('Error getting recent pixels:', error);
    throw createError('Failed to get recent pixels', 500);
  }
}));

// GET /api/canvas/info - Get canvas information
router.get('/info', asyncHandler(async (req: Request, res: Response) => {
  try {
    const canvasSize = await blockchainService?.getCanvasSize();
    const latestBlock = await blockchainService?.getLatestBlockNumber();
    const connectedClients = socketService?.getConnectedClientsCount() || 0;
    const canvasRoomSize = await socketService?.getCanvasRoomSize() || 0;
    
    res.json({
      success: true,
      data: {
        canvas: canvasSize || { width: 3000, height: 3000 },
        blockchain: {
          latestBlock,
          isListening: blockchainService?.isEventListening() || false,
          contractAddress: process.env.CHROMA_CONTRACT_ADDRESS
        },
        realtime: {
          connectedClients,
          canvasRoomSize
        },
        server: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }
      }
    });
  } catch (error) {
    logger.error('Error getting canvas info:', error);
    throw createError('Failed to get canvas info', 500);
  }
}));

// GET /api/canvas/price/:x/:y - Get current pixel price
router.get('/price/:x/:y', asyncHandler(async (req: Request, res: Response) => {
  const { x, y } = req.params;

  const pixelX = parseInt(x);
  const pixelY = parseInt(y);

  if (isNaN(pixelX) || isNaN(pixelY)) {
    throw createError('Invalid coordinates: x and y must be numbers', 400);
  }

  try {
    const price = await blockchainService?.getPixelPrice(pixelX, pixelY);
    
    res.json({
      success: true,
      data: {
        coordinates: { x: pixelX, y: pixelY },
        price: price || '0'
      }
    });
  } catch (error) {
    logger.error(`Error getting pixel price (${pixelX}, ${pixelY}):`, error);
    throw createError('Failed to get pixel price', 500);
  }
}));

export { router as canvasRouter };