-- SQL script to create the chroma_pixels table in Supabase
-- Run this in your Supabase SQL Editor to create the required table

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

-- Create indexes for better performance
CREATE INDEX idx_chroma_pixels_coords ON chroma_pixels(x, y);
CREATE INDEX idx_chroma_pixels_owner ON chroma_pixels(owner);
CREATE INDEX idx_chroma_pixels_timestamp ON chroma_pixels(timestamp);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE chroma_pixels ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (you can customize this based on your security needs)
CREATE POLICY "Allow all operations on chroma_pixels" ON chroma_pixels
  FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON chroma_pixels TO anon;
GRANT ALL ON chroma_pixels TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE chroma_pixels_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE chroma_pixels_id_seq TO authenticated;