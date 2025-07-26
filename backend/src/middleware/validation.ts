import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { createError } from './errorHandler';
import { logger } from '../utils/logger';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));
    
    logger.warn({
      message: 'Validation failed',
      errors: errorMessages,
      ip: req.ip,
      url: req.url,
      method: req.method
    });
    
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errorMessages
      }
    });
    return;
  }
  
  next();
};

// Ethereum address validation
export const validateEthereumAddress = (field: string) => {
  return body(field)
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage(`${field} must be a valid Ethereum address`);
};

// Coordinate validation for Chroma game
export const validateCoordinates = () => {
  return [
    body('x')
      .isInt({ min: 0, max: 2999 })
      .withMessage('x coordinate must be between 0 and 2999'),
    body('y')
      .isInt({ min: 0, max: 2999 })
      .withMessage('y coordinate must be between 0 and 2999')
  ];
};

// Color validation (24-bit RGB)
export const validateColor = () => {
  return body('color')
    .isInt({ min: 0, max: 16777215 }) // 0x000000 to 0xFFFFFF
    .withMessage('Color must be a valid 24-bit RGB value (0-16777215)');
};

// Transaction hash validation
export const validateTransactionHash = (field: string) => {
  return body(field)
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage(`${field} must be a valid transaction hash`);
};

// Pagination validation
export const validatePagination = () => {
  return [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ];
};

// Round ID validation
export const validateRoundId = () => {
  return param('roundId')
    .isInt({ min: 1 })
    .withMessage('Round ID must be a positive integer');
};

// Sanitize HTML content to prevent XSS
export const sanitizeInput = () => {
  return [
    body('*').escape(), // Escape HTML entities in all body fields
    query('*').escape(), // Escape HTML entities in all query parameters
  ];
};

// Validate pixel placement request
export const validatePixelPlacement = () => {
  return [
    ...validateCoordinates(),
    validateColor(),
    validateTransactionHash('transactionHash'),
    body('gasUsed')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Gas used must be a non-negative integer'),
    body('gasPrice')
      .optional()
      .isString()
      .matches(/^\d+$/)
      .withMessage('Gas price must be a valid number string')
  ];
};

// Validate pixel lock request
export const validatePixelLock = () => {
  return [
    ...validateCoordinates(),
    validateColor(),
    validateTransactionHash('transactionHash'),
    body('lockDuration')
      .optional()
      .isInt({ min: 1, max: 86400 }) // Max 24 hours
      .withMessage('Lock duration must be between 1 and 86400 seconds')
  ];
};

// Validate fountain coin toss request
export const validateCoinToss = () => {
  return [
    validateTransactionHash('transactionHash'),
    body('amount')
      .isString()
      .matches(/^\d+$/)
      .withMessage('Amount must be a valid number string (wei)'),
    body('roundId')
      .isInt({ min: 1 })
      .withMessage('Round ID must be a positive integer')
  ];
};

// Validate user stats request
export const validateUserStatsRequest = () => {
  return [
    param('address')
      .isString()
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Address must be a valid Ethereum address'),
    query('gameType')
      .optional()
      .isIn(['chroma', 'fountain', 'all'])
      .withMessage('Game type must be chroma, fountain, or all')
  ];
};

// Validate WebSocket authentication
export const validateWebSocketAuth = () => {
  return [
    body('address')
      .optional()
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Address must be a valid Ethereum address'),
    body('signature')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Signature must be a non-empty string')
  ];
};

// Custom validation for specific business rules
export const validateBusinessRules = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if pixel coordinates are within canvas bounds
    if (req.body.x !== undefined && req.body.y !== undefined) {
      const x = parseInt(req.body.x);
      const y = parseInt(req.body.y);
      
      if (x < 0 || x >= 3000 || y < 0 || y >= 3000) {
        return next(createError('Coordinates are outside canvas bounds', 400));
      }
    }
    
    // Validate color is not transparent (alpha channel)
    if (req.body.color !== undefined) {
      const color = parseInt(req.body.color);
      if (color < 0 || color > 16777215) {
        return next(createError('Invalid color value', 400));
      }
    }
    
    next();
  };
};

// Rate limiting validation (check if user is within cooldown)
export const validateUserCooldown = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return next(createError('User address is required', 400));
      }
      
      // This would typically check against database
      // For now, we'll just validate the address format
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addressRegex.test(address)) {
        return next(createError('Invalid Ethereum address format', 400));
      }
      
      next();
    } catch (error) {
      logger.error('Error validating user cooldown:', error);
      next(createError('Internal server error during validation', 500));
    }
  };
};