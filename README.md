# BaseArcade - Onchain Gaming Platform

BaseArcade is a decentralized gaming platform built on the Base network, featuring innovative onchain games like Chroma (collaborative pixel art) and The Fountain (prediction markets).

## Features

- **Chroma Game**: Collaborative pixel art canvas where users can place colored pixels
- **The Fountain**: Prediction market game with dynamic prize pools
- **Wallet Integration**: Seamless connection with Rainbow Kit and Wagmi
- **Real-time Updates**: Live game state synchronization via WebSocket
- **Responsive Design**: Modern UI built with React, TypeScript, and Tailwind CSS

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- A Web3 wallet (MetaMask, Coinbase Wallet, etc.)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd baseArcade
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:
```bash
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run check` - Run type checking, linting, and tests

## Architecture

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion
- **Blockchain**: Wagmi + Viem + RainbowKit
- **State Management**: Zustand
- **Backend**: Node.js + Express + Socket.io
- **Database**: Supabase
- **Network**: Base Sepolia (testnet)
