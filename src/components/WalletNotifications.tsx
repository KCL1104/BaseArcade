import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { notificationService } from '../services/notificationService'
import { celebrationService } from '../services/celebrationService'
import { analyticsService } from '../services/analyticsService'

export function WalletNotifications() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()

  // Handle wallet connection state changes
  useEffect(() => {
    if (isConnected && address) {
      notificationService.walletConnected(address)
      celebrationService.welcome()
      analyticsService.trackWalletConnected(address)
    }
  }, [isConnected, address])

  // Handle wallet disconnection
  useEffect(() => {
    if (!isConnected && !isConnecting && !isReconnecting) {
      // Only show disconnection notification if we were previously connected
      const wasConnected = localStorage.getItem('wallet-was-connected')
      if (wasConnected) {
        notificationService.walletDisconnected()
        analyticsService.trackWalletDisconnected()
        localStorage.removeItem('wallet-was-connected')
      }
    } else if (isConnected) {
      localStorage.setItem('wallet-was-connected', 'true')
    }
  }, [isConnected, isConnecting, isReconnecting])

  // This component doesn't render anything, it just handles notifications
  return null
}