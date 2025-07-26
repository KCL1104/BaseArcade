import { notificationService } from './notificationService'
import type { Hash } from 'viem'

export interface TransactionState {
  hash?: Hash
  status: 'idle' | 'pending' | 'success' | 'error'
  error?: Error
  timestamp?: number
}

export interface TransactionOptions {
  onSuccess?: (hash: Hash) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
  showNotifications?: boolean
}

class TransactionService {
  private transactions = new Map<string, TransactionState>()
  private listeners = new Map<string, Set<(state: TransactionState) => void>>()

  // Track a new transaction
  trackTransaction(
    id: string,
    transactionPromise: Promise<Hash>,
    options: TransactionOptions = {}
  ): Promise<Hash> {
    const { 
      onSuccess, 
      onError, 
      successMessage = 'Transaction successful!',
      showNotifications = true 
    } = options

    // Set initial pending state
    this.updateTransactionState(id, {
      status: 'pending',
      timestamp: Date.now()
    })

    // Show pending notification
    let pendingToastId: string | number | undefined
    if (showNotifications) {
      pendingToastId = notificationService.transactionPending()
    }

    return transactionPromise
      .then((hash) => {
        // Update to success state
        this.updateTransactionState(id, {
          hash,
          status: 'success',
          timestamp: Date.now()
        })

        // Dismiss pending notification and show success
        if (showNotifications && pendingToastId) {
          notificationService.dismiss(pendingToastId)
          notificationService.transactionSuccess(successMessage, {
            txHash: hash,
            explorerUrl: 'https://sepolia.basescan.org'
          })
        }

        // Call success callback
        onSuccess?.(hash)
        
        return hash
      })
      .catch((error) => {
        // Update to error state
        this.updateTransactionState(id, {
          status: 'error',
          error,
          timestamp: Date.now()
        })

        // Dismiss pending notification and show error
        if (showNotifications && pendingToastId) {
          notificationService.dismiss(pendingToastId)
          notificationService.transactionError(error)
        }

        // Call error callback
        onError?.(error)
        
        throw error
      })
  }

  // Update transaction state and notify listeners
  private updateTransactionState(id: string, state: Partial<TransactionState>) {
    const currentState = this.transactions.get(id) || { status: 'idle' as const }
    const newState = { ...currentState, ...state }
    
    this.transactions.set(id, newState)
    
    // Notify all listeners for this transaction
    const listeners = this.listeners.get(id)
    if (listeners) {
      listeners.forEach(listener => listener(newState))
    }
  }

  // Get current transaction state
  getTransactionState(id: string): TransactionState {
    return this.transactions.get(id) || { status: 'idle' }
  }

  // Subscribe to transaction state changes
  subscribeToTransaction(
    id: string, 
    listener: (state: TransactionState) => void
  ): () => void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set())
    }
    
    this.listeners.get(id)!.add(listener)
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(id)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.listeners.delete(id)
        }
      }
    }
  }

  // Clear transaction state
  clearTransaction(id: string) {
    this.transactions.delete(id)
    this.listeners.delete(id)
  }

  // Clear all transactions
  clearAllTransactions() {
    this.transactions.clear()
    this.listeners.clear()
  }

  // Check if any transaction is pending
  hasPendingTransactions(): boolean {
    return Array.from(this.transactions.values()).some(
      state => state.status === 'pending'
    )
  }

  // Get all pending transactions
  getPendingTransactions(): Array<{ id: string; state: TransactionState }> {
    const pending: Array<{ id: string; state: TransactionState }> = []
    
    this.transactions.forEach((state, id) => {
      if (state.status === 'pending') {
        pending.push({ id, state })
      }
    })
    
    return pending
  }

  // Utility method for common transaction patterns
  async executeTransaction(
    id: string,
    transactionFn: () => Promise<Hash>,
    options: TransactionOptions = {}
  ): Promise<Hash> {
    try {
      const hash = await this.trackTransaction(id, transactionFn(), options)
      return hash
    } catch (error) {
      console.error(`Transaction ${id} failed:`, error)
      throw error
    }
  }
}

// Export singleton instance
export const transactionService = new TransactionService()
export default transactionService