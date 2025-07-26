import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '../utils/logger';

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:3000',
      'https://basearcade.vercel.app',
      'https://base-arcade.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean); // Remove undefined values
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({
        message: 'CORS policy violation',
        origin,
        allowedOrigins
      });
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-User-Address'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours
};

// Security headers configuration
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      scriptSrc: ["'self'"],
      connectSrc: [
        "'self'",
        'wss:',
        'https://api.base.org',
        'https://sepolia.base.org',
        'https://mainnet.base.org'
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for WebSocket compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
};

// Apply CORS middleware
export const corsMiddleware = cors(corsOptions);

// Apply security headers
export const securityHeaders = helmet(helmetOptions);

// Custom security middleware
export const customSecurity = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add API version header
  res.setHeader('X-API-Version', '1.0.0');
  
  next();
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!clientIP) {
      logger.warn('Unable to determine client IP address');
      res.status(403).json({
        success: false,
        error: {
          message: 'Access denied: Unable to verify IP address',
          code: 'IP_VERIFICATION_FAILED'
        }
      });
      return;
    }
    
    // Check if IP is in whitelist
    const isAllowed = allowedIPs.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation support (basic)
        return clientIP.startsWith(allowedIP.split('/')[0]);
      }
      return clientIP === allowedIP;
    });
    
    if (!isAllowed) {
      logger.warn({
        message: 'IP not in whitelist',
        clientIP,
        allowedIPs,
        url: req.url,
        method: req.method
      });
      
      res.status(403).json({
        success: false,
        error: {
          message: 'Access denied: IP not authorized',
          code: 'IP_NOT_AUTHORIZED'
        }
      });
      return;
    }
    
    next();
  };
};

// Request size limiter
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        logger.warn({
          message: 'Request size exceeded limit',
          contentLength: sizeInBytes,
          maxSize: maxSizeInBytes,
          ip: req.ip,
          url: req.url
        });
        
        res.status(413).json({
          success: false,
          error: {
            message: 'Request entity too large',
            code: 'REQUEST_TOO_LARGE',
            maxSize
          }
        });
        return;
      }
    }
    
    next();
  };
};

// Helper function to parse size strings (e.g., '10mb', '1gb')
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
}

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.header('X-API-Key');
  const validApiKeys = process.env.API_KEYS?.split(',') || [];
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        message: 'API key required',
        code: 'API_KEY_REQUIRED'
      }
    });
    return;
  }
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn({
      message: 'Invalid API key used',
      apiKey: apiKey.substring(0, 8) + '...', // Log only first 8 characters
      ip: req.ip,
      url: req.url
    });
    
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid API key',
        code: 'INVALID_API_KEY'
      }
    });
    return;
  }
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log request
  logger.info({
    message: 'Incoming request',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });
  
  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  (res as any).end = function(chunk?: any, encoding?: BufferEncoding, cb?: () => void) {
    const duration = Date.now() - start;
    
    logger.info({
      message: 'Request completed',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
    
    if (arguments.length === 0) {
      return originalEnd();
    } else if (arguments.length === 1) {
      return originalEnd(chunk);
    } else if (arguments.length === 2) {
      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding as any);
      } else {
        return originalEnd(chunk, encoding as any);
      }
    } else {
      return originalEnd(chunk, encoding as any, cb);
    }
  };
  
  next();
};