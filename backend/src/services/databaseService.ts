import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { Pixel, GameStats } from '../types';
import { createError } from '../middleware/errorHandler';

export class DatabaseService {
  private supabase: SupabaseClient;
  private tableExists: boolean = false;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw createError('Missing Supabase configuration', 500);
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async initialize(): Promise<void> {
    try {
      // Test connection with a simple query
      const { error } = await this.supabase.from('chroma_pixels').select('count').limit(1);
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Table doesn't exist, create it
          logger.info('chroma_pixels table does not exist, creating it...');
          await this.createTablesIfNotExists();
        } else {
          // Other database error
          logger.error('Database connection error:', error);
          this.tableExists = false;
          logger.warn('Database connection failed, continuing with limited functionality');
          return;
        }
      } else {
        this.tableExists = true;
      }
      
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      this.tableExists = false;
      logger.warn('Starting service without database functionality');
    }
  }

  private async createTablesIfNotExists(): Promise<void> {
    try {
      // First, try to query the table to see if it exists
      const { error: queryError } = await this.supabase
        .from('chroma_pixels')
        .select('id')
        .limit(1);
      
      if (queryError && queryError.code === 'PGRST116') {
        // Table doesn't exist, we need to create it manually
        logger.info('chroma_pixels table does not exist. Please create it manually in your Supabase dashboard.');
        logger.info('SQL to create the table:');
        logger.info(`
          CREATE TABLE chroma_pixels (
            id SERIAL PRIMARY KEY,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            color VARCHAR(7) NOT NULL,
            owner VARCHAR(42) NOT NULL,
            price VARCHAR(50) DEFAULT '0',
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            transaction_hash VARCHAR(66) NOT NULL,
            UNIQUE(x, y)
          );
          
          CREATE INDEX idx_chroma_pixels_coords ON chroma_pixels(x, y);
          CREATE INDEX idx_chroma_pixels_owner ON chroma_pixels(owner);
          CREATE INDEX idx_chroma_pixels_timestamp ON chroma_pixels(timestamp);
        `);
        
        // For now, we'll continue without the table and return empty results
        this.tableExists = false;
        logger.warn('Service will continue with limited functionality until table is created');
        return;
      }
      
      this.tableExists = true;
      logger.info('Database tables verified successfully');
    } catch (error) {
      logger.warn('Table verification failed, service will continue with limited functionality:', error);
      this.tableExists = false;
    }
  }

  async savePixel(pixel: Omit<Pixel, 'id'>): Promise<Pixel> {
    try {
      const { data, error } = await this.supabase
        .from('chroma_pixels')
        .upsert({
          x: pixel.x,
          y: pixel.y,
          color: pixel.color,
          owner: pixel.owner,
          price: pixel.price,
          timestamp: pixel.timestamp.toISOString(),
          transaction_hash: pixel.transaction_hash
        }, {
          onConflict: 'x,y'
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to save pixel:', error);
        throw createError('Failed to save pixel', 500);
      }

      return {
        ...data,
        timestamp: new Date(data.timestamp)
      } as Pixel;
    } catch (error) {
      logger.error('Error saving pixel:', error);
      throw error;
    }
  }

  async getCanvasRegion(x: number, y: number, width: number, height: number): Promise<Pixel[]> {
    if (!this.tableExists) {
      logger.debug('Table does not exist, returning empty canvas region');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('chroma_pixels')
        .select('*')
        .gte('x', x)
        .lt('x', x + width)
        .gte('y', y)
        .lt('y', y + height)
        .order('timestamp', { ascending: false });

      if (error) {
        logger.error('Failed to get canvas region:', error);
        return []; // Return empty array instead of throwing error
      }

      return (data || []).map(pixel => ({
        ...pixel,
        timestamp: new Date(pixel.timestamp)
      })) as Pixel[];
    } catch (error) {
      logger.error('Error getting canvas region:', error);
      return []; // Return empty array instead of throwing error
    }
  }

  async getPixel(x: number, y: number): Promise<Pixel | null> {
    try {
      const { data, error } = await this.supabase
        .from('chroma_pixels')
        .select('*')
        .eq('x', x)
        .eq('y', y)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No pixel found
        }
        logger.error('Failed to get pixel:', error);
        throw createError('Failed to get pixel', 500);
      }

      return {
        ...data,
        timestamp: new Date(data.timestamp)
      } as Pixel;
    } catch (error) {
      logger.error('Error getting pixel:', error);
      throw error;
    }
  }

  async getGameStats(): Promise<GameStats> {
    if (!this.tableExists) {
      logger.debug('Table does not exist, returning default game stats');
      return {
        totalPixelsPlaced: 0,
        totalRevenue: '0',
        uniqueArtists: 0,
        averagePixelPrice: '0',
        mostExpensivePixel: null,
        recentActivity: {
          count: 0,
          timeframe: '24h'
        }
      };
    }

    try {
      // Get total pixels placed
      const { count: totalPixels } = await this.supabase
        .from('chroma_pixels')
        .select('*', { count: 'exact', head: true });

      // Get unique artists
      const { data: uniqueArtistsData } = await this.supabase
        .from('chroma_pixels')
        .select('owner')
        .not('owner', 'is', null);

      const uniqueArtists = new Set(uniqueArtistsData?.map(p => p.owner) || []).size;

      // Get most expensive pixel
      const { data: expensivePixelData } = await this.supabase
        .from('chroma_pixels')
        .select('x, y, price, owner')
        .order('price', { ascending: false })
        .limit(1)
        .single();

      // Get recent activity (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count: recentCount } = await this.supabase
        .from('chroma_pixels')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', twentyFourHoursAgo.toISOString());

      // Calculate total revenue and average price
      const { data: priceData } = await this.supabase
        .from('chroma_pixels')
        .select('price');

      const prices = priceData?.map(p => parseFloat(p.price)) || [];
      const totalRevenue = prices.reduce((sum, price) => sum + price, 0);
      const averagePrice = prices.length > 0 ? totalRevenue / prices.length : 0;

      return {
        totalPixelsPlaced: totalPixels || 0,
        totalRevenue: totalRevenue.toString(),
        uniqueArtists,
        averagePixelPrice: averagePrice.toString(),
        mostExpensivePixel: expensivePixelData || null,
        recentActivity: {
          count: recentCount || 0,
          timeframe: '24h'
        }
      };
    } catch (error) {
      logger.error('Error getting game stats:', error);
      // Return default stats instead of throwing error
      return {
        totalPixelsPlaced: 0,
        totalRevenue: '0',
        uniqueArtists: 0,
        averagePixelPrice: '0',
        mostExpensivePixel: null,
        recentActivity: {
          count: 0,
          timeframe: '24h'
        }
      };
    }
  }

  async getRecentPixels(limit: number = 50): Promise<Pixel[]> {
    try {
      const { data, error } = await this.supabase
        .from('chroma_pixels')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get recent pixels:', error);
        throw createError('Failed to get recent pixels', 500);
      }

      return (data || []).map(pixel => ({
        ...pixel,
        timestamp: new Date(pixel.timestamp)
      })) as Pixel[];
    } catch (error) {
      logger.error('Error getting recent pixels:', error);
      throw error;
    }
  }
}