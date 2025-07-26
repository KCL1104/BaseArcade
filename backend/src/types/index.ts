export interface Pixel {
  id?: number;
  x: number;
  y: number;
  color: string;
  owner: string;
  price: string;
  timestamp: Date;
  transaction_hash: string;
}

export interface CanvasData {
  pixels: Pixel[];
  totalPixels: number;
  lastUpdate: Date;
}

export interface GameStats {
  totalPixelsPlaced: number;
  totalRevenue: string;
  uniqueArtists: number;
  averagePixelPrice: string;
  mostExpensivePixel: {
    x: number;
    y: number;
    price: string;
    owner: string;
  } | null;
  recentActivity: {
    count: number;
    timeframe: string;
  };
}

export interface PixelChangedEvent {
  x: number;
  y: number;
  color: string;
  owner: string;
  price: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
}

export interface SocketEvents {
  // Client to server
  'join-canvas': () => void;
  'leave-canvas': () => void;
  'get-canvas-region': (data: { x: number; y: number; width: number; height: number }) => void;
  
  // Server to client
  'pixel-updated': (pixel: Pixel) => void;
  'canvas-region': (data: { pixels: Pixel[]; region: { x: number; y: number; width: number; height: number } }) => void;
  'stats-updated': (stats: GameStats) => void;
  'error': (error: { message: string; code?: string }) => void;
}

export interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface BlockchainConfig {
  rpcUrl: string;
  contractAddress: string;
  privateKey?: string;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  allowedOrigins: string[];
  logLevel: string;
  database: DatabaseConfig;
  blockchain: BlockchainConfig;
}