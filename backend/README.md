# Base Arcade - Chroma Backend Service

This is the backend service for the Chroma pixel art game, providing real-time WebSocket communication, blockchain event listening, and API endpoints for canvas data.

## Features

- **Real-time Communication**: WebSocket support via Socket.IO for live pixel updates
- **Blockchain Integration**: Listens to Chroma smart contract events on Base Sepolia
- **Database Storage**: Supabase PostgreSQL for pixel data persistence
- **RESTful API**: Endpoints for canvas regions, game statistics, and pixel data
- **Event Synchronization**: Automatic sync between blockchain events and database

## Setup

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account and project
- Base Sepolia RPC access

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
- Set up Supabase URL and keys
- Configure Base Sepolia RPC URL
- Set Chroma contract address

### Database Setup

Create the following table in your Supabase database:

```sql
CREATE TABLE chroma_pixels (
  id SERIAL PRIMARY KEY,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  color VARCHAR(7) NOT NULL,
  owner VARCHAR(42) NOT NULL,
  price VARCHAR(78) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transaction_hash VARCHAR(66) NOT NULL,
  UNIQUE(x, y)
);

CREATE INDEX idx_chroma_pixels_coordinates ON chroma_pixels(x, y);
CREATE INDEX idx_chroma_pixels_timestamp ON chroma_pixels(timestamp DESC);
CREATE INDEX idx_chroma_pixels_owner ON chroma_pixels(owner);
```

## Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Canvas API (`/api/canvas`)

- `GET /api/canvas/region?x=0&y=0&width=100&height=100` - Get pixels in region
- `GET /api/canvas/pixel/:x/:y` - Get specific pixel
- `GET /api/canvas/recent?limit=50` - Get recent pixel changes
- `GET /api/canvas/info` - Get canvas and service information
- `GET /api/canvas/price/:x/:y` - Get current pixel price

### Game Stats API (`/api/game-stats`)

- `GET /api/game-stats` - Get overall game statistics
- `GET /api/game-stats/summary` - Get summarized statistics
- `GET /api/game-stats/activity?timeframe=24h` - Get activity statistics
- `GET /api/game-stats/realtime` - Get real-time connection statistics
- `GET /api/game-stats/health` - Service health check

## WebSocket Events

### Client to Server
- `join-canvas` - Join canvas room for updates
- `leave-canvas` - Leave canvas room
- `get-canvas-region` - Request canvas region data

### Server to Client
- `pixel-updated` - Broadcast when pixel changes
- `canvas-region` - Send requested canvas region
- `stats-updated` - Broadcast updated game statistics
- `error` - Send error messages

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │◄──►│   Backend API    │◄──►│   Supabase DB   │
│   (React)       │    │   (Express)      │    │   (PostgreSQL)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Blockchain     │
                       │   (Base Sepolia) │
                       └──────────────────┘
```

## Services

- **DatabaseService**: Handles Supabase operations and pixel storage
- **BlockchainService**: Listens to smart contract events and syncs data
- **SocketService**: Manages WebSocket connections and real-time updates

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `NODE_ENV` | Environment | No (default: development) |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint | Yes |
| `CHROMA_CONTRACT_ADDRESS` | Deployed Chroma contract address | Yes |
| `PRIVATE_KEY` | Private key for event listening | Yes |
| `ALLOWED_ORIGINS` | CORS allowed origins | No |
| `LOG_LEVEL` | Logging level | No (default: info) |

## Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables

3. Start the server:
```bash
npm start
```

## Monitoring

- Health check: `GET /health`
- Service status: `GET /api/game-stats/health`
- Logs are written to `logs/` directory
- Real-time metrics available via WebSocket

## Contributing

1. Follow TypeScript best practices
2. Add proper error handling
3. Include logging for debugging
4. Test API endpoints thoroughly
5. Update documentation for new features