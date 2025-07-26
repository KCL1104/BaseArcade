import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { notificationService } from '../services/notificationService'

// Enhanced wallet connection hook with notifications
export function useWalletWithNotifications() {
  const account = useAccount()
  const { connect, connectors } = useConnect({
    mutation: {
      onError: (error: Error) => {
        notificationService.walletConnectionError(error.message)
      },
      onSuccess: () => {
        // Success is handled by the useEffect in WalletNotifications
      }
    }
  })
  const { disconnect } = useDisconnect({
    mutation: {
      onSuccess: () => {
        notificationService.walletDisconnected()
      },
      onError: (error: Error) => {
        notificationService.error(`Failed to disconnect: ${error.message}`)
      }
    }
  })

  const connectWallet = async (connectorId?: string) => {
    try {
      const connector = connectorId 
        ? connectors.find(c => c.id === connectorId) 
        : connectors[0]
      
      if (!connector) {
        notificationService.error('No wallet connector available')
        return
      }

      notificationService.loading('Connecting wallet...')
      await connect({ connector })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notificationService.error(`Failed to connect wallet: ${errorMessage}`)
    }
  }

  const disconnectWallet = async () => {
    try {
      await disconnect()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notificationService.error(`Failed to disconnect: ${errorMessage}`)
    }
  }

  return {
    ...account,
    connectWallet,
    disconnectWallet,
    connectors
  }
}