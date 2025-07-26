import request from 'supertest';
import express, { Application } from 'express';

describe('Server API Tests', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
      });
    });
    
    app.post('/api/pixels', (req, res) => {
      const { x, y, color } = req.body;
      
      if (typeof x !== 'number' || typeof y !== 'number' || !color) {
        res.status(400).json({ error: 'Invalid input' });
        return;
      }
      
      res.json({ success: true, x, y, color });
    });
    
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: req.originalUrl,
      });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('Request Validation', () => {
    it('should validate pixel placement data', async () => {
      const response = await request(app)
        .post('/api/pixels')
        .send({ x: 'invalid', y: 0, color: '#FF0000' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should accept valid pixel placement data', async () => {
      const response = await request(app)
        .post('/api/pixels')
        .send({ x: 0, y: 0, color: '#FF0000' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.x).toBe(0);
      expect(response.body.y).toBe(0);
      expect(response.body.color).toBe('#FF0000');
    });
  });
});