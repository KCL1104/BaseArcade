import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { Pixel } from '../types';

export class SocketService {
  private io: Server;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  initialize(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // Handle client joining canvas
      socket.on('join-canvas', () => {
        socket.join('canvas');
        logger.info(`Client ${socket.id} joined canvas room`);
      });

      // Handle client leaving canvas
      socket.on('leave-canvas', () => {
        socket.leave('canvas');
        logger.info(`Client ${socket.id} left canvas room`);
      });

      // Handle canvas region requests
      socket.on('get-canvas-region', async (data: { x: number; y: number; width: number; height: number }) => {
        try {
          // This will be handled by the database service
          // For now, just acknowledge the request
          logger.info(`Canvas region requested by ${socket.id}:`, data);
        } catch (error) {
          logger.error('Error handling canvas region request:', error);
          socket.emit('error', { message: 'Failed to get canvas region' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for client ${socket.id}:`, error);
      });
    });

    logger.info('Socket service initialized');
  }

  // Broadcast pixel update to all clients in canvas room
  broadcastPixelUpdate(pixel: Pixel): void {
    try {
      this.io.to('canvas').emit('pixel-updated', pixel);
      logger.debug(`Broadcasted pixel update: (${pixel.x}, ${pixel.y})`);
    } catch (error) {
      logger.error('Error broadcasting pixel update:', error);
    }
  }

  // Send canvas region to specific client
  sendCanvasRegion(
    socketId: string,
    pixels: Pixel[],
    region: { x: number; y: number; width: number; height: number }
  ): void {
    try {
      const socket = this.connectedClients.get(socketId);
      if (socket) {
        socket.emit('canvas-region', { pixels, region });
        logger.debug(`Sent canvas region to ${socketId}:`, region);
      }
    } catch (error) {
      logger.error('Error sending canvas region:', error);
    }
  }

  // Broadcast game stats update
  broadcastStatsUpdate(stats: Record<string, unknown>): void {
    try {
      this.io.to('canvas').emit('stats-updated', stats);
      logger.debug('Broadcasted stats update');
    } catch (error) {
      logger.error('Error broadcasting stats update:', error);
    }
  }

  // Send error to specific client
  sendError(socketId: string, message: string, code?: string): void {
    try {
      const socket = this.connectedClients.get(socketId);
      if (socket) {
        socket.emit('error', { message, code });
        logger.debug(`Sent error to ${socketId}: ${message}`);
      }
    } catch (error) {
      logger.error('Error sending error message:', error);
    }
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Get clients in canvas room
  getCanvasRoomSize(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.io.in('canvas').allSockets()
        .then(sockets => resolve(sockets.size))
        .catch(reject);
    });
  }

  // Broadcast to all connected clients
  broadcast(event: string, data: Record<string, unknown>): void {
    try {
      this.io.emit(event, data);
      logger.debug(`Broadcasted event: ${event}`);
    } catch (error) {
      logger.error(`Error broadcasting event ${event}:`, error);
    }
  }

  // Send to specific room
  sendToRoom(room: string, event: string, data: Record<string, unknown>): void {
    try {
      this.io.to(room).emit(event, data);
      logger.debug(`Sent event ${event} to room ${room}`);
    } catch (error) {
      logger.error(`Error sending event ${event} to room ${room}:`, error);
    }
  }
}