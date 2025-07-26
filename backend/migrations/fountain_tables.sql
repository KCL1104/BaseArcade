-- The Fountain Game Database Schema
-- This script creates the necessary tables for The Fountain game

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

-- Views for common queries

-- View for active rounds with participant counts
CREATE OR REPLACE VIEW fountain_active_rounds AS
SELECT 
    fr.*,
    COALESCE(toss_counts.participant_count, 0) as actual_participants
FROM fountain_rounds fr
LEFT JOIN (
    SELECT 
        round_id,
        COUNT(*) as participant_count
    FROM fountain_tosses
    GROUP BY round_id
) toss_counts ON fr.round_id = toss_counts.round_id
WHERE fr.is_complete = FALSE
ORDER BY fr.start_time DESC;

-- View for completed rounds with winner information
CREATE OR REPLACE VIEW fountain_completed_rounds AS
SELECT 
    fr.*,
    fw.winner_address,
    fw.prize_amount,
    fw.timestamp as winner_selected_at,
    COALESCE(toss_counts.participant_count, 0) as actual_participants
FROM fountain_rounds fr
LEFT JOIN fountain_winners fw ON fr.round_id = fw.round_id
LEFT JOIN (
    SELECT 
        round_id,
        COUNT(*) as participant_count
    FROM fountain_tosses
    GROUP BY round_id
) toss_counts ON fr.round_id = toss_counts.round_id
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

-- Comments for documentation
COMMENT ON TABLE fountain_rounds IS 'Stores information about each fountain game round';
COMMENT ON TABLE fountain_tosses IS 'Stores individual coin tosses (participations) in fountain rounds';
COMMENT ON TABLE fountain_winners IS 'Stores winner information for completed rounds';

COMMENT ON COLUMN fountain_rounds.prize_pool IS 'Total prize pool for the round in wei (stored as text)';
COMMENT ON COLUMN fountain_rounds.prize_amount IS 'Amount won by the winner in wei (stored as text)';
COMMENT ON COLUMN fountain_tosses.entry_fee IS 'Entry fee paid by participant in wei (stored as text)';
COMMENT ON COLUMN fountain_winners.prize_amount IS 'Prize amount won in wei (stored as text)';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON fountain_rounds TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON fountain_tosses TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON fountain_winners TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;