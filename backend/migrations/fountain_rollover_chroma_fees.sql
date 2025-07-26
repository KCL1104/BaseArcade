-- Fountain Rollover and Chroma Fees Migration
-- This script adds the necessary fields and tables for rollover mechanics and Chroma fee tracking

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

-- Update the completed rounds view to include rollover information
CREATE OR REPLACE VIEW fountain_completed_rounds AS
SELECT 
    fr.*,
    fw.winner_address,
    fw.prize_amount,
    fw.timestamp as winner_selected_at,
    COALESCE(toss_counts.participant_count, 0) as actual_participants,
    COALESCE(chroma_fees.total_chroma_fees, '0') as total_chroma_fees_received
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

-- Update the active rounds view to include rollover and Chroma fees
CREATE OR REPLACE VIEW fountain_active_rounds AS
SELECT 
    fr.*,
    COALESCE(toss_counts.participant_count, 0) as actual_participants,
    COALESCE(chroma_fees.total_chroma_fees, '0') as total_chroma_fees_received
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
    frh.*,
    fr_from.start_time as from_round_start,
    fr_from.end_time as from_round_end,
    fr_to.start_time as to_round_start,
    fr_to.end_time as to_round_end
FROM fountain_rollover_history frh
JOIN fountain_rounds fr_from ON frh.from_round_id = fr_from.round_id
JOIN fountain_rounds fr_to ON frh.to_round_id = fr_to.round_id
ORDER BY frh.timestamp DESC;

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

-- Comments for documentation
COMMENT ON COLUMN fountain_rounds.rollover_amount IS 'Amount rolled over from this round to the next in wei (stored as text)';
COMMENT ON COLUMN fountain_rounds.chroma_fees_received IS 'Total Chroma fees received in this round in wei (stored as text)';
COMMENT ON TABLE fountain_chroma_fees IS 'Tracks individual Chroma fee transactions received by the Fountain';
COMMENT ON TABLE fountain_rollover_history IS 'Tracks rollover amounts between rounds';
COMMENT ON COLUMN fountain_chroma_fees.amount IS 'Chroma fee amount in wei (stored as text)';
COMMENT ON COLUMN fountain_rollover_history.rollover_amount IS 'Rollover amount in wei (stored as text)';