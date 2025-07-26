import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter, wsConnectionLimiter } from './middleware/rateLimiter';
import { corsMiddleware, securityHeaders, customSecurity, requestLogger, requestSizeLimiter } from './middleware/security';
import { canvasRouter, initializeCanvasController } from './controllers/canvasController';
import { gameStatsRouter, initializeGameStatsController } from './controllers/gameStatsController';
import { SocketService } from './services/socketService';
import { BlockchainService } from './services/blockchainService';
import { DatabaseService } from './services/databaseService';
import chromaRoutes, { getChromaServiceInstance } from './routes/chroma';
import fountainRoutes, { getFountainServiceInstance } from './routes/fountain';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Security Middleware (order matters)
app.use(requestLogger); // Log all requests
app.use(securityHeaders); // Apply security headers
app.use(customSecurity); // Custom security headers
app.use(corsMiddleware); // CORS configuration
app.use(generalLimiter); // General rate limiting
app.use(requestSizeLimiter('10mb')); // Limit request size
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' })); // JSON parsing with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL encoding with size limit

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/canvas', canvasRouter);
app.use('/api/game-stats', gameStatsRouter);
app.use('/api/chroma', chromaRoutes);
app.use('/api/fountain', fountainRoutes);

// Error handling middleware
app.use(errorHandler);

// Initialize services
const initializeServices = async () => {
  try {
    // Initialize database service
    const databaseService = new DatabaseService();
    await databaseService.initialize();
    logger.info('Database service initialized');

    // Initialize socket service
    const socketService = new SocketService(io);
    socketService.initialize();
    logger.info('Socket service initialized');

    // Setup WebSocket handling with rate limiting
    io.use((socket, next) => {
      // Apply WebSocket connection rate limiting
      const req = socket.request as express.Request;
      const res = {
        status: () => ({
          json: () => {}
        }),
        sendStatus: () => {},
        links: () => {},
        send: () => {},
        json: () => {}
      } as unknown as express.Response;
      
      wsConnectionLimiter(req, res, (err?: any) => {
        if (err) {
          logger.warn(`WebSocket connection rejected due to rate limiting: ${socket.id}`);
          return next(new Error('Rate limit exceeded'));
        }
        next();
      });
    });
    
    io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id} from IP: ${socket.handshake.address}`);
      
      // Set connection timeout
      socket.timeout(30000); // 30 seconds timeout for inactive connections
      
      // Add client to fountain service for real-time updates
       getFountainServiceInstance().addWebSocketClient(socket);
       
       // Add client to chroma service for real-time updates
       getChromaServiceInstance().addWebSocketClient(socket);
      
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        
        // Remove client from services
        getFountainServiceInstance().removeWebSocketClient(socket);
        getChromaServiceInstance().removeWebSocketClient(socket);
      });
    });

    // Initialize blockchain service
    const blockchainService = new BlockchainService(socketService, databaseService);
    await blockchainService.initialize();
    logger.info('Blockchain service initialized');

    // Initialize controllers with services
    initializeCanvasController(databaseService, blockchainService, socketService);
    initializeGameStatsController(databaseService, blockchainService, socketService);
    logger.info('Controllers initialized with services');

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    logger.warn('Service will continue with limited functionality');
    // Don't exit process, allow service to continue
  }
};

// Start server
server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  await initializeServices();
});

// Export app for testing
export { app };

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});