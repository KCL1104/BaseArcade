import { Contract, WebSocketProvider, JsonRpcProvider } from 'ethers';
import { logger } from '../utils/logger';
import { SocketService } from './socketService';
import { DatabaseService } from './databaseService';
import { PixelChangedEvent } from '../types';
import { createError } from '../middleware/errorHandler';

// Chroma contract ABI (only the events and functions we need)
const CHROMA_ABI = [
  'event PixelChanged(uint256 indexed x, uint256 indexed y, string color, address indexed owner, uint256 price)',
  'function getPixel(uint256 x, uint256 y) view returns (string memory color, address owner, uint256 price)',
  'function getPixelPrice(uint256 x, uint256 y) view returns (uint256)',
  'function CANVAS_WIDTH() view returns (uint256)',
  'function CANVAS_HEIGHT() view returns (uint256)'
];

export class BlockchainService {
  private provider: JsonRpcProvider | WebSocketProvider;
  private contract: Contract;
  private socketService: SocketService;
  private databaseService: DatabaseService;
  private isListening: boolean = false;

  constructor(socketService: SocketService, databaseService: DatabaseService) {
    this.socketService = socketService;
    this.databaseService = databaseService;

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
    const contractAddress = process.env.CHROMA_CONTRACT_ADDRESS;

    if (!rpcUrl || !contractAddress) {
      throw createError('Missing blockchain configuration', 500);
    }

    // Use WebSocket provider if available, otherwise HTTP
    if (rpcUrl.startsWith('ws://') || rpcUrl.startsWith('wss://')) {
      this.provider = new WebSocketProvider(rpcUrl);
    } else {
      this.provider = new JsonRpcProvider(rpcUrl);
    }

    this.contract = new Contract(contractAddress, CHROMA_ABI, this.provider);
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const network = await this.provider.getNetwork();
      logger.info(`Connected to blockchain network: ${network.name} (${network.chainId})`);

      // Test contract connection
      const canvasWidth = await this.contract.CANVAS_WIDTH();
      const canvasHeight = await this.contract.CANVAS_HEIGHT();
      logger.info(`Contract connected - Canvas size: ${canvasWidth}x${canvasHeight}`);

      // Start listening to events
      await this.startEventListening();
      
      logger.info('Blockchain service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize blockchain service:', error);
      throw createError('Blockchain initialization failed', 500);
    }
  }

  private async startEventListening(): Promise<void> {
    try {
      if (this.isListening) {
        logger.warn('Event listening already started');
        return;
      }

      // Listen for PixelChanged events
      this.contract.on('PixelChanged', async (x, y, color, owner, price, event) => {
        try {
          const pixelEvent: PixelChangedEvent = {
            x: Number(x),
            y: Number(y),
            color: color,
            owner: owner,
            price: price.toString(),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            timestamp: new Date()
          };

          logger.info(`PixelChanged event received: (${pixelEvent.x}, ${pixelEvent.y}) by ${pixelEvent.owner}`);

          // Save to database
          const savedPixel = await this.databaseService.savePixel({
            x: pixelEvent.x,
            y: pixelEvent.y,
            color: pixelEvent.color,
            owner: pixelEvent.owner,
            price: pixelEvent.price,
            timestamp: pixelEvent.timestamp,
            transaction_hash: pixelEvent.transactionHash
          });

          // Broadcast to connected clients
          this.socketService.broadcastPixelUpdate(savedPixel);

          // Update and broadcast game stats
          const stats = await this.databaseService.getGameStats();
          this.socketService.broadcastStatsUpdate(stats as any);

        } catch (error) {
          logger.error('Error processing PixelChanged event:', error);
        }
      });

      // Handle provider errors
      this.provider.on('error', (error) => {
        logger.error('Provider error:', error);
        this.handleProviderError(error);
      });

      // Handle WebSocket specific events if using WebSocket provider
      if (this.provider instanceof WebSocketProvider) {
        const wsProvider = this.provider as WebSocketProvider;
        if (wsProvider.websocket) {
          (wsProvider.websocket as any).on('close', (code: number, reason: string) => {
            logger.warn(`WebSocket connection closed: ${code} - ${reason}`);
            this.isListening = false;
            this.reconnect();
          });

          (wsProvider.websocket as any).on('error', (error: Error) => {
            logger.error('WebSocket error:', error);
            this.handleProviderError(error);
          });
        }
      }

      this.isListening = true;
      logger.info('Started listening for blockchain events');
    } catch (error) {
      logger.error('Failed to start event listening:', error);
      throw error;
    }
  }

  private async handleProviderError(error: Error): Promise<void> {
    logger.error('Provider error occurred:', error);
    this.isListening = false;
    
    // Attempt to reconnect after a delay
    setTimeout(() => {
      this.reconnect();
    }, 5000);
  }

  private async reconnect(): Promise<void> {
    try {
      logger.info('Attempting to reconnect to blockchain...');
      
      // Remove all listeners
      this.contract.removeAllListeners();
      
      // Close existing WebSocket connection if it exists
      if (this.provider instanceof WebSocketProvider) {
        const wsProvider = this.provider as WebSocketProvider;
        if (wsProvider.websocket) {
          wsProvider.websocket.close();
        }
      }
      
      // Reinitialize provider
      const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL!;
      if (rpcUrl.startsWith('ws://') || rpcUrl.startsWith('wss://')) {
        this.provider = new WebSocketProvider(rpcUrl);
      } else {
        this.provider = new JsonRpcProvider(rpcUrl);
      }
      
      // Recreate contract instance
      this.contract = new Contract(process.env.CHROMA_CONTRACT_ADDRESS!, CHROMA_ABI, this.provider);
      
      // Restart event listening
      await this.startEventListening();
      
      logger.info('Successfully reconnected to blockchain');
    } catch (error) {
      logger.error('Failed to reconnect to blockchain:', error);
      // Try again after a longer delay
      setTimeout(() => {
        this.reconnect();
      }, 15000);
    }
  }

  async getPixel(x: number, y: number): Promise<{ color: string; owner: string; price: string } | null> {
    try {
      const result = await this.contract.getPixel(x, y);
      return {
        color: result[0],
        owner: result[1],
        price: result[2].toString()
      };
    } catch (error) {
      logger.error(`Error getting pixel (${x}, ${y}) from contract:`, error);
      return null;
    }
  }

  async getPixelPrice(x: number, y: number): Promise<string | null> {
    try {
      const price = await this.contract.getPixelPrice(x, y);
      return price.toString();
    } catch (error) {
      logger.error(`Error getting pixel price (${x}, ${y}) from contract:`, error);
      return null;
    }
  }

  async getCanvasSize(): Promise<{ width: number; height: number } | null> {
    try {
      const width = await this.contract.CANVAS_WIDTH();
      const height = await this.contract.CANVAS_HEIGHT();
      return {
        width: Number(width),
        height: Number(height)
      };
    } catch (error) {
      logger.error('Error getting canvas size from contract:', error);
      return null;
    }
  }

  isEventListening(): boolean {
    return this.isListening;
  }

  async getLatestBlockNumber(): Promise<number | null> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      logger.error('Error getting latest block number:', error);
      return null;
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    try {
      this.contract.removeAllListeners();
      if (this.provider instanceof WebSocketProvider) {
        const wsProvider = this.provider as WebSocketProvider;
        if (wsProvider.websocket) {
          wsProvider.websocket.close();
        }
      }
      this.isListening = false;
      logger.info('Blockchain service cleaned up');
    } catch (error) {
      logger.error('Error during blockchain service cleanup:', error);
    }
  }
}