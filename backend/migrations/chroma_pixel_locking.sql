-- Chroma Pixel Locking and User Cooldown Migration
-- This script adds the necessary fields and tables for pixel locking and user cooldowns

-- Add new columns to chroma_pixels table for locking functionality
ALTER TABLE chroma_pixels 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lock_price TEXT; -- Stored as string to handle big numbers

-- Create table for user cooldowns
CREATE TABLE IF NOT EXISTS chroma_user_cooldowns (
    id SERIAL PRIMARY KEY,
    user_address TEXT NOT NULL UNIQUE,
    last_placement TIMESTAMP WITH TIME ZONE NOT NULL,
    cooldown_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chroma_pixels_locked ON chroma_pixels(is_locked) WHERE is_locked = TRUE;
CREATE INDEX IF NOT EXISTS idx_chroma_pixels_locked_until ON chroma_pixels(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chroma_user_cooldowns_address ON chroma_user_cooldowns(user_address);
CREATE INDEX IF NOT EXISTS idx_chroma_user_cooldowns_until ON chroma_user_cooldowns(cooldown_until);

-- Function to update the updated_at timestamp for user cooldowns
CREATE OR REPLACE FUNCTION update_chroma_user_cooldowns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_chroma_user_cooldowns_updated_at ON chroma_user_cooldowns;
CREATE TRIGGER trigger_update_chroma_user_cooldowns_updated_at
    BEFORE UPDATE ON chroma_user_cooldowns
    FOR EACH ROW
    EXECUTE FUNCTION update_chroma_user_cooldowns_updated_at();

-- View for active locked pixels
CREATE OR REPLACE VIEW chroma_active_locked_pixels AS
SELECT 
    id,
    x,
    y,
    color,
    owner,
    price,
    locked_until,
    lock_price,
    timestamp
FROM chroma_pixels
WHERE is_locked = TRUE 
  AND locked_until > NOW()
ORDER BY locked_until DESC;

-- View for users currently on cooldown
CREATE OR REPLACE VIEW chroma_users_on_cooldown AS
SELECT 
    user_address,
    last_placement,
    cooldown_until,
    EXTRACT(EPOCH FROM (cooldown_until - NOW())) as remaining_seconds
FROM chroma_user_cooldowns
WHERE cooldown_until > NOW()
ORDER BY cooldown_until ASC;

-- Enable Row Level Security for new table
ALTER TABLE chroma_user_cooldowns ENABLE ROW LEVEL SECURITY;

-- Create policies for the new table
CREATE POLICY "Allow all operations on chroma_user_cooldowns" ON chroma_user_cooldowns
  FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON chroma_user_cooldowns TO anon;
GRANT ALL ON chroma_user_cooldowns TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE chroma_user_cooldowns_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE chroma_user_cooldowns_id_seq TO authenticated;

-- Comments for documentation
COMMENT ON COLUMN chroma_pixels.locked_until IS 'Timestamp when pixel lock expires';
COMMENT ON COLUMN chroma_pixels.is_locked IS 'Whether pixel is currently locked';
COMMENT ON COLUMN chroma_pixels.lock_price IS 'Price paid to lock the pixel in wei (stored as text)';
COMMENT ON TABLE chroma_user_cooldowns IS 'Tracks user cooldowns for pixel placement';
COMMENT ON COLUMN chroma_user_cooldowns.last_placement IS 'Timestamp of users last pixel placement';
COMMENT ON COLUMN chroma_user_cooldowns.cooldown_until IS 'Timestamp when user cooldown expires';