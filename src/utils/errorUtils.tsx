import React from 'react'
import { notificationService } from '../services/notificationService'
import ErrorBoundary, { type Props as ErrorBoundaryProps } from '../components/ErrorBoundary'

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    console.error('Manual error report:', error, errorInfo)
    
    notificationService.error('An error occurred', {
      description: error.message || 'Something went wrong',
      duration: 6000
    })
  }
}