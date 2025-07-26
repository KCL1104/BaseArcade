import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'Rate limit exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(15 * 60) // 15 minutes in seconds
      }
    });
  }
});

// Strict rate limiter for game actions (pixel placement, coin tosses)
export const gameActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 game actions per minute
  message: {
    success: false,
    error: {
      message: 'Too many game actions, please slow down.',
      code: 'GAME_ACTION_RATE_LIMIT'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'Game action rate limit exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many game actions, please slow down.',
        code: 'GAME_ACTION_RATE_LIMIT',
        retryAfter: 60
      }
    });
  }
});

// Authentication rate limiter
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'Authentication rate limit exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many authentication attempts, please try again later.',
        code: 'AUTH_RATE_LIMIT',
        retryAfter: Math.round(15 * 60)
      }
    });
  }
});

// WebSocket connection rate limiter
export const wsConnectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 WebSocket connections per minute
  message: {
    success: false,
    error: {
      message: 'Too many WebSocket connection attempts.',
      code: 'WS_CONNECTION_RATE_LIMIT'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'WebSocket connection rate limit exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many WebSocket connection attempts.',
        code: 'WS_CONNECTION_RATE_LIMIT',
        retryAfter: 60
      }
    });
  }
});

// Create custom rate limiter for specific endpoints
export const createCustomLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        message,
        code: 'CUSTOM_RATE_LIMIT'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn({
        message: 'Custom rate limit exceeded',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        customMessage: message
      });
      
      res.status(429).json({
        success: false,
        error: {
          message,
          code: 'CUSTOM_RATE_LIMIT',
          retryAfter: Math.round(windowMs / 1000)
        }
      });
    }
  });
};