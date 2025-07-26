-- =====================================================
-- Base Arcade - Complete Supabase Database Setup Script
-- =====================================================
-- This script sets up the complete database schema for Base Arcade
-- including Chroma game, Fountain game, and cross-game integration
--
-- INSTRUCTIONS:
-- 1. Open your Supabase dashboard
-- 2. Go to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Execute the script
-- 5. Verify all tables and views are created successfully
--
-- EXECUTION ORDER:
-- 1. Core Chroma tables
-- 2. Fountain game tables
-- 3. Pixel locking enhancements
-- 4. Cross-game integration features
-- =====================================================

-- =====================================================
-- STEP 1: CORE CHROMA GAME TABLES
-- =====================================================

-- Main pixel canvas table
CREATE TABLE IF NOT EXISTS chroma_pixels (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chroma_pixels_coords ON chroma_pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_chroma_pixels_owner ON chroma_pixels(owner);
CREATE INDEX IF NOT EXISTS idx_chroma_pixels_timestamp ON chroma_pixels(timestamp);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE chroma_pixels ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations
CREATE POLICY "Allow all operations on chroma_pixels" ON chroma_pixels
  FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON chroma_pixels TO anon;
GRANT ALL ON chroma_pixels TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE chroma_pixels_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE chroma_pixels_id_seq TO authenticated;

-- =====================================================
-- STEP 2: FOUNTAIN GAME TABLES
-- =====================================================

-- Table to store fountain game rounds
CREATE TABLE IF NOT EXISTS fountain_rounds (
    id SERIAL PRIMARY KEY,
    round_id INTEGER UNIQUE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    prize_pool TEXT NOT NULL DEFAULT '0', -- Stored as string to handle big numbers
    total_participants INTEGER NOT NULL DEFAULT 0,
    winner_address TEXT,
    prize_amount TEXT, -- Stored as string to handle big numbers
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    winner_selected_at TIMESTAMP WITH TIME ZONE,
    transaction_hash TEXT,
    block_number BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store individual coin tosses (participations)
CREATE TABLE IF NOT EXISTS fountain_tosses (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL,
    participant_address TEXT NOT NULL,
    entry_fee TEXT NOT NULL, -- Stored as string to handle big numbers
    transaction_hash TEXT NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_fountain_tosses_round
        FOREIGN KEY (round_id) 
        REFERENCES fountain_rounds(round_id)
        ON DELETE CASCADE,
    
    -- Ensure one participation per user per round
    CONSTRAINT unique_participant_per_round 
        UNIQUE (round_id, participant_address)
);

-- Table to store winners for easy querying
CREATE TABLE IF NOT EXISTS fountain_winners (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL,
    winner_address TEXT NOT NULL,
    prize_amount TEXT NOT NULL, -- Stored as string to handle big numbers
    transaction_hash TEXT NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_fountain_winners_round
        FOREIGN KEY (round_id) 
        REFERENCES fountain_rounds(round_id)
        ON DELETE CASCADE,
    
    -- Ensure one winner per round
    CONSTRAINT unique_winner_per_round 
        UNIQUE (round_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fountain_rounds_round_id ON fountain_rounds(round_id);
CREATE INDEX IF NOT EXISTS idx_fountain_rounds_start_time ON fountain_rounds(start_time);
CREATE INDEX IF NOT EXISTS idx_fountain_rounds_is_complete ON fountain_rounds(is_complete);
CREATE INDEX IF NOT EXISTS idx_fountain_rounds_winner ON fountain_rounds(winner_address) WHERE winner_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fountain_tosses_round_id ON fountain_tosses(round_id);
CREATE INDEX IF NOT EXISTS idx_fountain_tosses_participant ON fountain_tosses(participant_address);
CREATE INDEX IF NOT EXISTS idx_fountain_tosses_timestamp ON fountain_tosses(timestamp);
CREATE INDEX IF NOT EXISTS idx_fountain_tosses_tx_hash ON fountain_tosses(transaction_hash);

CREATE INDEX IF NOT EXISTS idx_fountain_winners_round_id ON fountain_winners(round_id);
CREATE INDEX IF NOT EXISTS idx_fountain_winners_address ON fountain_winners(winner_address);
CREATE INDEX IF NOT EXISTS idx_fountain_winners_timestamp ON fountain_winners(timestamp);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_fountain_rounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_fountain_rounds_updated_at ON fountain_rounds;
CREATE TRIGGER trigger_update_fountain_rounds_updated_at
    BEFORE UPDATE ON fountain_rounds
    FOR EACH ROW
    EXECUTE FUNCTION update_fountain_rounds_updated_at();

-- =====================================================
-- STEP 3: PIXEL LOCKING ENHANCEMENTS
-- =====================================================

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

-- =====================================================
-- STEP 4: CROSS-GAME INTEGRATION FEATURES
-- =====================================================

-- Add new columns to fountain_rounds table for rollover functionality
ALTER TABLE fountain_rounds 
ADD COLUMN IF NOT EXISTS rollover_amount TEXT DEFAULT '0', -- Amount rolled over to next round
ADD COLUMN IF NOT EXISTS chroma_fees_received TEXT DEFAULT '0'; -- Chroma fees received in this round

-- Create table to track Chroma fees received
CREATE TABLE IF NOT EXISTS fountain_chroma_fees (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL,
    amount TEXT NOT NULL, -- Stored as string to handle big numbers
    transaction_hash TEXT NOT NULL,
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_fountain_chroma_fees_round
        FOREIGN KEY (round_id) 
        REFERENCES fountain_rounds(round_id)
        ON DELETE CASCADE
);

-- Create table to track rollover history
CREATE TABLE IF NOT EXISTS fountain_rollover_history (
    id SERIAL PRIMARY KEY,
    from_round_id INTEGER NOT NULL,
    to_round_id INTEGER NOT NULL,
    rollover_amount TEXT NOT NULL, -- Stored as string to handle big numbers
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_fountain_rollover_from_round
        FOREIGN KEY (from_round_id) 
        REFERENCES fountain_rounds(round_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_fountain_rollover_to_round
        FOREIGN KEY (to_round_id) 
        REFERENCES fountain_rounds(round_id)
        ON DELETE CASCADE,
    
    -- Ensure unique rollover per round transition
    CONSTRAINT unique_rollover_transition 
        UNIQUE (from_round_id, to_round_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fountain_chroma_fees_round_id ON fountain_chroma_fees(round_id);
CREATE INDEX IF NOT EXISTS idx_fountain_chroma_fees_timestamp ON fountain_chroma_fees(timestamp);
CREATE INDEX IF NOT EXISTS idx_fountain_chroma_fees_tx_hash ON fountain_chroma_fees(transaction_hash);

CREATE INDEX IF NOT EXISTS idx_fountain_rollover_from_round ON fountain_rollover_history(from_round_id);
CREATE INDEX IF NOT EXISTS idx_fountain_rollover_to_round ON fountain_rollover_history(to_round_id);
CREATE INDEX IF NOT EXISTS idx_fountain_rollover_timestamp ON fountain_rollover_history(timestamp);

-- Update the fountain_rounds indexes
CREATE INDEX IF NOT EXISTS idx_fountain_rounds_rollover ON fountain_rounds(rollover_amount) WHERE rollover_amount != '0';
CREATE INDEX IF NOT EXISTS idx_fountain_rounds_chroma_fees ON fountain_rounds(chroma_fees_received) WHERE chroma_fees_received != '0';

-- Enable Row Level Security for new tables
ALTER TABLE fountain_chroma_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fountain_rollover_history ENABLE ROW LEVEL SECURITY;

-- Create policies for the new tables
CREATE POLICY "Allow all operations on fountain_chroma_fees" ON fountain_chroma_fees
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on fountain_rollover_history" ON fountain_rollover_history
  FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON fountain_chroma_fees TO anon;
GRANT ALL ON fountain_chroma_fees TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE fountain_chroma_fees_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE fountain_chroma_fees_id_seq TO authenticated;

GRANT ALL ON fountain_rollover_history TO anon;
GRANT ALL ON fountain_rollover_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE fountain_rollover_history_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE fountain_rollover_history_id_seq TO authenticated;

-- =====================================================
-- STEP 5: USEFUL VIEWS FOR QUERYING
-- =====================================================

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

-- View for active rounds with participant counts
CREATE OR REPLACE VIEW fountain_active_rounds AS
SELECT 
    fr.id,
    fr.round_id,
    fr.start_time,
    fr.end_time,
    fr.prize_pool,
    fr.total_participants,
    fr.winner_address,
    fr.prize_amount,
    fr.is_complete,
    fr.winner_selected_at,
    fr.transaction_hash,
    fr.block_number,
    fr.created_at,
    fr.updated_at,
    fr.rollover_amount,
    fr.chroma_fees_received,
    COALESCE(toss_counts.participant_count, 0) as actual_participants,
    COALESCE(chroma_fees.total_chroma_fees, '0') as chroma_fees_total
FROM fountain_rounds fr
LEFT JOIN (
    SELECT 
        round_id,
        COUNT(*) as participant_count
    FROM fountain_tosses
    GROUP BY round_id
) toss_counts ON fr.round_id = toss_counts.round_id
LEFT JOIN (
    SELECT 
        round_id,
        SUM(amount::NUMERIC)::TEXT as total_chroma_fees
    FROM fountain_chroma_fees
    GROUP BY round_id
) chroma_fees ON fr.round_id = chroma_fees.round_id
WHERE fr.is_complete = FALSE
ORDER BY fr.start_time DESC;

-- View for completed rounds with winner information
CREATE OR REPLACE VIEW fountain_completed_rounds AS
SELECT 
    fr.id,
    fr.round_id,
    fr.start_time,
    fr.end_time,
    fr.prize_pool,
    fr.total_participants,
    fr.prize_amount,
    fr.is_complete,
    fr.winner_selected_at,
    fr.transaction_hash,
    fr.block_number,
    fr.created_at,
    fr.updated_at,
    fr.rollover_amount,
    fr.chroma_fees_received,
    fw.winner_address,
    fw.prize_amount as winner_prize_amount,
    fw.timestamp as winner_selected_at_winners,
    COALESCE(toss_counts.participant_count, 0) as actual_participants,
    COALESCE(chroma_fees.total_chroma_fees, '0') as chroma_fees_total
FROM fountain_rounds fr
LEFT JOIN fountain_winners fw ON fr.round_id = fw.round_id
LEFT JOIN (
    SELECT 
        round_id,
        COUNT(*) as participant_count
    FROM fountain_tosses
    GROUP BY round_id
) toss_counts ON fr.round_id = toss_counts.round_id
LEFT JOIN (
    SELECT 
        round_id,
        SUM(amount::NUMERIC)::TEXT as total_chroma_fees
    FROM fountain_chroma_fees
    GROUP BY round_id
) chroma_fees ON fr.round_id = chroma_fees.round_id
WHERE fr.is_complete = TRUE
ORDER BY fr.start_time DESC;

-- View for user statistics
CREATE OR REPLACE VIEW fountain_user_stats AS
SELECT 
    participant_address,
    COUNT(*) as total_participations,
    COUNT(DISTINCT round_id) as unique_rounds_participated,
    SUM(entry_fee::NUMERIC) as total_spent,
    MIN(timestamp) as first_participation,
    MAX(timestamp) as last_participation,
    COALESCE(win_stats.total_wins, 0) as total_wins,
    COALESCE(win_stats.total_winnings, 0) as total_winnings
FROM fountain_tosses ft
LEFT JOIN (
    SELECT 
        winner_address,
        COUNT(*) as total_wins,
        SUM(prize_amount::NUMERIC) as total_winnings
    FROM fountain_winners
    GROUP BY winner_address
) win_stats ON ft.participant_address = win_stats.winner_address
GROUP BY participant_address, win_stats.total_wins, win_stats.total_winnings;

-- View for Chroma fees summary by round
CREATE OR REPLACE VIEW fountain_chroma_fees_summary AS
SELECT 
    fcf.round_id,
    fr.start_time,
    fr.end_time,
    COUNT(fcf.id) as fee_transactions_count,
    SUM(fcf.amount::NUMERIC) as total_chroma_fees,
    MIN(fcf.timestamp) as first_fee_received,
    MAX(fcf.timestamp) as last_fee_received
FROM fountain_chroma_fees fcf
JOIN fountain_rounds fr ON fcf.round_id = fr.round_id
GROUP BY fcf.round_id, fr.start_time, fr.end_time
ORDER BY fcf.round_id DESC;

-- View for rollover history with round details
CREATE OR REPLACE VIEW fountain_rollover_summary AS
SELECT 
    frh.id,
    frh.from_round_id,
    frh.to_round_id,
    frh.rollover_amount,
    frh.timestamp,
    frh.created_at,
    fr_from.start_time as from_round_start,
    fr_from.end_time as from_round_end,
    fr_to.start_time as to_round_start,
    fr_to.end_time as to_round_end
FROM fountain_rollover_history frh
JOIN fountain_rounds fr_from ON frh.from_round_id = fr_from.round_id
JOIN fountain_rounds fr_to ON frh.to_round_id = fr_to.round_id
ORDER BY frh.timestamp DESC;

-- =====================================================
-- STEP 6: DOCUMENTATION COMMENTS
-- =====================================================

-- Comments for documentation
COMMENT ON TABLE chroma_pixels IS 'Main canvas for Chroma pixel art game';
COMMENT ON COLUMN chroma_pixels.locked_until IS 'Timestamp when pixel lock expires';
COMMENT ON COLUMN chroma_pixels.is_locked IS 'Whether pixel is currently locked';
COMMENT ON COLUMN chroma_pixels.lock_price IS 'Price paid to lock the pixel in wei (stored as text)';

COMMENT ON TABLE chroma_user_cooldowns IS 'Tracks user cooldowns for pixel placement';
COMMENT ON COLUMN chroma_user_cooldowns.last_placement IS 'Timestamp of users last pixel placement';
COMMENT ON COLUMN chroma_user_cooldowns.cooldown_until IS 'Timestamp when user cooldown expires';

COMMENT ON TABLE fountain_rounds IS 'Stores information about each fountain game round';
COMMENT ON TABLE fountain_tosses IS 'Stores individual coin tosses (participations) in fountain rounds';
COMMENT ON TABLE fountain_winners IS 'Stores winner information for completed rounds';

COMMENT ON COLUMN fountain_rounds.prize_pool IS 'Total prize pool for the round in wei (stored as text)';
COMMENT ON COLUMN fountain_rounds.prize_amount IS 'Amount won by the winner in wei (stored as text)';
COMMENT ON COLUMN fountain_rounds.rollover_amount IS 'Amount rolled over from this round to the next in wei (stored as text)';
COMMENT ON COLUMN fountain_rounds.chroma_fees_received IS 'Total Chroma fees received in this round in wei (stored as text)';

COMMENT ON TABLE fountain_chroma_fees IS 'Tracks individual Chroma fee transactions received by the Fountain';
COMMENT ON TABLE fountain_rollover_history IS 'Tracks rollover amounts between rounds';
COMMENT ON COLUMN fountain_chroma_fees.amount IS 'Chroma fee amount in wei (stored as text)';
COMMENT ON COLUMN fountain_rollover_history.rollover_amount IS 'Rollover amount in wei (stored as text)';

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Your Base Arcade database is now ready!
-- 
-- Tables created:
-- - chroma_pixels (with locking features)
-- - chroma_user_cooldowns
-- - fountain_rounds (with rollover features)
-- - fountain_tosses
-- - fountain_winners
-- - fountain_chroma_fees
-- - fountain_rollover_history
--
-- Views created:
-- - chroma_active_locked_pixels
-- - chroma_users_on_cooldown
-- - fountain_active_rounds
-- - fountain_completed_rounds
-- - fountain_user_stats
-- - fountain_chroma_fees_summary
-- - fountain_rollover_summary
--
-- All tables have proper indexes, RLS policies, and permissions set.
-- =====================================================