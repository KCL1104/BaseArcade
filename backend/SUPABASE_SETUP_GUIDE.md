# Base Arcade - Supabase Database Setup Guide

This guide will help you set up the complete Base Arcade database schema in your Supabase project.

## 📋 Prerequisites

- A Supabase account (free tier is sufficient)
- A Supabase project created
- Access to your Supabase dashboard

## 🚀 Quick Setup (Recommended)

### Step 1: Access Supabase SQL Editor

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Execute the Setup Script

1. Open the file `supabase_complete_setup.sql` in this directory
2. Copy the entire contents of the file
3. Paste it into the Supabase SQL Editor
4. Click **Run** to execute the script

### Step 3: Verify Installation

After running the script, verify that all tables were created:

1. Go to **Table Editor** in your Supabase dashboard
2. You should see the following tables:
   - `chroma_pixels`
   - `chroma_user_cooldowns`
   - `fountain_rounds`
   - `fountain_tosses`
   - `fountain_winners`
   - `fountain_chroma_fees`
   - `fountain_rollover_history`

## 📊 Database Schema Overview

### Chroma Game Tables

#### `chroma_pixels`
- **Purpose**: Main canvas for pixel art game
- **Key Features**: 
  - Pixel coordinates (x, y)
  - Color and ownership tracking
  - Pixel locking functionality
  - Price history

#### `chroma_user_cooldowns`
- **Purpose**: Tracks user cooldowns between pixel placements
- **Key Features**:
  - 1-minute cooldown enforcement
  - Last placement tracking
  - Automatic expiration

### Fountain Game Tables

#### `fountain_rounds`
- **Purpose**: Stores fountain game round information
- **Key Features**:
  - Round timing and status
  - Prize pool tracking
  - Winner information
  - Rollover mechanics
  - Chroma fee integration

#### `fountain_tosses`
- **Purpose**: Individual user participations
- **Key Features**:
  - Entry fee tracking
  - One participation per user per round
  - Transaction history

#### `fountain_winners`
- **Purpose**: Winner records for easy querying
- **Key Features**:
  - Prize distribution tracking
  - Winner history

### Cross-Game Integration Tables

#### `fountain_chroma_fees`
- **Purpose**: Tracks Chroma fees flowing to Fountain
- **Key Features**:
  - 50% of Chroma fees go to Fountain prize pool
  - Transaction-level tracking

#### `fountain_rollover_history`
- **Purpose**: Tracks prize rollover between rounds
- **Key Features**:
  - 15% of prizes roll over to next round
  - Historical rollover tracking

## 🔍 Useful Views

The setup script also creates several views for easy data querying:

- `chroma_active_locked_pixels` - Currently locked pixels
- `chroma_users_on_cooldown` - Users currently on cooldown
- `fountain_active_rounds` - Active fountain rounds with stats
- `fountain_completed_rounds` - Completed rounds with winner info
- `fountain_user_stats` - User participation statistics
- `fountain_chroma_fees_summary` - Chroma fee summary by round
- `fountain_rollover_summary` - Rollover history with details

## 🔧 Manual Setup (Alternative)

If you prefer to run the migrations step by step:

### Step 1: Core Tables
```sql
-- Run: backend/create_table.sql
```

### Step 2: Fountain Tables
```sql
-- Run: backend/migrations/fountain_tables.sql
```

### Step 3: Pixel Locking
```sql
-- Run: backend/migrations/chroma_pixel_locking.sql
```

### Step 4: Cross-Game Integration
```sql
-- Run: backend/migrations/fountain_rollover_chroma_fees.sql
```

## 🔐 Security & Permissions

The setup script automatically configures:

- **Row Level Security (RLS)** enabled on all tables
- **Policies** allowing all operations (customize as needed)
- **Permissions** for `anon` and `authenticated` users
- **Sequence permissions** for auto-incrementing IDs

## 🎯 Game Mechanics Implemented

### Chroma Game
- ✅ Pixel placement and ownership
- ✅ Dynamic pricing
- ✅ Pixel locking (50x price for 1 hour protection)
- ✅ User cooldowns (1 minute between placements)
- ✅ Cross-game fee sharing (50% to Fountain)

### Fountain Game
- ✅ Round-based gameplay
- ✅ Prize pool accumulation
- ✅ Random winner selection
- ✅ Prize distribution (85% to winner, 15% rollover)
- ✅ Chroma fee integration

## 🔍 Troubleshooting

### Common Issues

**Error: "relation already exists"**
- This is normal if you're re-running the script
- The script uses `IF NOT EXISTS` to prevent conflicts

**Error: "permission denied"**
- Ensure you're using the correct Supabase project
- Check that you have admin access to the project

**Missing tables after execution**
- Check the SQL Editor for any error messages
- Ensure the entire script was copied and pasted
- Try running individual sections if needed

### Verification Queries

Run these queries to verify your setup:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'chroma_%' OR table_name LIKE 'fountain_%';

-- Check views exist
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';

-- Test a simple query
SELECT COUNT(*) FROM chroma_pixels;
```

## 📞 Support

If you encounter any issues:

1. Check the Supabase logs in your dashboard
2. Verify your project permissions
3. Try running the script in smaller sections
4. Check the troubleshooting section above

## 🎉 Next Steps

After successful database setup:

1. Update your `.env` files with Supabase credentials
2. Test the backend API endpoints
3. Verify frontend connectivity
4. Deploy your smart contracts
5. Start playing!

---

**Happy Gaming! 🎮**