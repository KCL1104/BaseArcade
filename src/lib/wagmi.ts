import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base, baseSepolia } from 'wagmi/chains'

// For development, we'll use a minimal configuration
// In production, replace with your actual WalletConnect project ID from https://cloud.walletconnect.com
export const config = getDefaultConfig({
  appName: 'Base Arcade',
  projectId: 'YOUR_PROJECT_ID', // Replace with actual project ID in production
  chains: [base, baseSepolia],
  ssr: false,
})