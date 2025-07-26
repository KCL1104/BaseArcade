import { toast } from 'sonner'
import { CheckCircle, XCircle, AlertCircle, Info, Loader2 } from 'lucide-react'
import { createElement } from 'react'

export interface NotificationOptions {
  title?: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface TransactionNotificationOptions extends NotificationOptions {
  txHash?: string
  explorerUrl?: string
}

class NotificationService {
  // Success notifications
  success(message: string, options?: NotificationOptions) {
    return toast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
      icon: createElement(CheckCircle, { className: 'w-4 h-4' }),
    })
  }

  // Error notifications
  error(message: string, options?: NotificationOptions) {
    return toast.error(message, {
      description: options?.description,
      duration: options?.duration || 6000,
      action: options?.action,
      icon: createElement(XCircle, { className: 'w-4 h-4' }),
    })
  }

  // Warning notifications
  warning(message: string, options?: NotificationOptions) {
    return toast.warning(message, {
      description: options?.description,
      duration: options?.duration || 5000,
      action: options?.action,
      icon: createElement(AlertCircle, { className: 'w-4 h-4' }),
    })
  }

  // Info notifications
  info(message: string, options?: NotificationOptions) {
    return toast.info(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
      icon: createElement(Info, { className: 'w-4 h-4' }),
    })
  }

  // Loading notifications
  loading(message: string, options?: NotificationOptions) {
    return toast.loading(message, {
      description: options?.description,
      icon: createElement(Loader2, { className: 'w-4 h-4 animate-spin' }),
    })
  }

  // Transaction-specific notifications
  transactionPending(options?: TransactionNotificationOptions) {
    return this.loading('Transaction pending...', {
      description: 'Please wait while your transaction is being processed',
      ...options,
    })
  }

  transactionSuccess(message: string, options?: TransactionNotificationOptions) {
    const action = options?.txHash ? {
      label: 'View on Explorer',
      onClick: () => {
        if (options.explorerUrl) {
          window.open(`${options.explorerUrl}/tx/${options.txHash}`, '_blank')
        }
      }
    } : undefined

    return this.success(message, {
      description: options?.description || 'Your transaction has been confirmed',
      action,
      ...options,
    })
  }

  transactionError(error: Error | string, options?: TransactionNotificationOptions) {
    const message = typeof error === 'string' ? error : error.message
    const userFriendlyMessage = this.getUserFriendlyErrorMessage(message)
    
    return this.error('Transaction failed', {
      description: userFriendlyMessage,
      ...options,
    })
  }

  // Wallet connection notifications
  walletConnected(address: string) {
    return this.success('Wallet connected', {
      description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
    })
  }

  walletDisconnected() {
    return this.info('Wallet disconnected', {
      description: 'You have been disconnected from your wallet',
    })
  }

  walletError(error: Error | string) {
    const message = typeof error === 'string' ? error : error.message
    return this.error('Wallet error', {
      description: this.getUserFriendlyErrorMessage(message),
    })
  }

  // Game-specific notifications
  pixelPlaced(coordinates: { x: number; y: number }, color: string) {
    return this.success(`Pixel placed at (${coordinates.x}, ${coordinates.y})`, {
      description: `Color: ${color}`,
      duration: 3000
    })
  }

  coinTossed(amount?: string) {
    return this.success('Coin tossed!', {
      description: amount ? `Amount: ${amount} ETH` : 'Good luck!',
      duration: 3000
    })
  }

  // Wallet notifications
  walletConnectionError(message: string) {
    return this.error('Wallet connection failed', {
      description: message,
      duration: 5000
    })
  }

  // Error formatting utility
  formatError(error: Error | string | { message?: string; reason?: string }): string {
    if (typeof error === 'string') return error
    if (error && 'message' in error && error.message) return error.message
    if (error && 'reason' in error && error.reason) return error.reason
    return 'An unexpected error occurred'
  }

  roundWon(amount: string) {
    return this.success('🎉 Congratulations!', {
      description: `You won ${amount} ETH from The Fountain!`,
      duration: 8000,
    })
  }

  // Utility method to convert technical errors to user-friendly messages
  private getUserFriendlyErrorMessage(error: string): string {
    if (error.includes('user rejected')) {
      return 'Transaction was cancelled by user'
    }
    if (error.includes('insufficient funds')) {
      return 'Insufficient funds to complete transaction'
    }
    if (error.includes('gas')) {
      return 'Transaction failed due to gas issues. Please try again.'
    }
    if (error.includes('network')) {
      return 'Network error. Please check your connection and try again.'
    }
    if (error.includes('nonce')) {
      return 'Transaction nonce error. Please try again.'
    }
    
    // Return original error if no specific mapping found
    return error.length > 100 ? error.substring(0, 100) + '...' : error
  }

  // Dismiss specific notification
  dismiss(toastId: string | number) {
    toast.dismiss(toastId)
  }

  // Dismiss all notifications
  dismissAll() {
    toast.dismiss()
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
export default notificationService