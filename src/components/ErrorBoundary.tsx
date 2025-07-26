import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { notificationService } from '../services/notificationService'

export interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Show error notification
    notificationService.error('Something went wrong', {
      description: 'An unexpected error occurred. Please try refreshing the page.',
      duration: 8000
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-space-900 via-space-800 to-space-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-accent-purple/30 rounded-xl p-8 text-center">
            {/* Error Icon */}
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-accent-red/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-accent-red" />
              </div>
            </div>

            {/* Error Message */}
            <h2 className="text-2xl font-heading font-bold text-white mb-4">
              Oops! Something went wrong
            </h2>
            
            <p className="text-gray-300 font-body mb-6">
              We encountered an unexpected error. Don't worry, your progress is safe.
            </p>

            {/* Error Details (in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 mb-2">
                  Error Details (Development)
                </summary>
                <div className="bg-gray-900/50 rounded p-3 text-xs text-gray-400 font-mono overflow-auto max-h-32">
                  <div className="text-accent-red mb-2">{this.state.error.message}</div>
                  <div className="text-gray-500">{this.state.error.stack}</div>
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full btn-primary flex items-center justify-center space-x-2 py-3"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 btn-secondary flex items-center justify-center space-x-2 py-2"
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>
                
                <button
                  onClick={this.handleRefresh}
                  className="flex-1 btn-secondary flex items-center justify-center space-x-2 py-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Support Message */}
            <p className="text-xs text-gray-500 mt-6">
              If this problem persists, please contact our support team.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary