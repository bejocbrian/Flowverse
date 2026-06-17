import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error Boundary component that catches React errors and displays a fallback UI
 * instead of crashing the entire application
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error info for potential reporting
    this.setState({
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { 
        title = 'Something went wrong',
        message = 'An unexpected error occurred. Please try again.',
        showReload = true,
        showHome = true,
        variant = 'default' // 'default', 'inline', 'fullscreen'
      } = this.props;

      // Inline variant - compact error for smaller areas
      if (variant === 'inline') {
        return (
          <div className="error-boundary-inline p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{message}</span>
              {showReload && (
                <button 
                  onClick={this.handleReload}
                  className="ml-2 text-xs underline hover:text-red-900"
                >
                  Reload
                </button>
              )}
            </div>
          </div>
        );
      }

      // Fullscreen variant - for full page errors
      if (variant === 'fullscreen') {
        return (
          <div className="error-boundary-fullscreen min-h-screen bg-[hsl(var(--canvas))] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))] mb-2">
                {title}
              </h2>
              <p className="text-[hsl(var(--text-secondary))] mb-6">
                {message}
              </p>
              <div className="flex gap-3 justify-center">
                {showReload && (
                  <button
                    onClick={this.handleReload}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--accent-primary))] text-white font-medium hover:opacity-90 transition-opacity"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Page
                  </button>
                )}
                {showHome && (
                  <button
                    onClick={this.handleGoHome}
                    className="px-4 py-2 rounded-lg border border-[hsl(var(--border))] font-medium hover:bg-[hsl(var(--hover))] transition-colors"
                  >
                    Go to Home
                  </button>
                )}
              </div>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-6 text-left text-xs text-[hsl(var(--text-secondary))]">
                  <summary className="cursor-pointer mb-2">Error Details</summary>
                  <pre className="p-2 bg-gray-100 rounded overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      }

      // Default variant - card-style error
      return (
        <div className="error-boundary-default p-6 bg-red-50 border border-red-200 rounded-xl my-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 mb-1">{title}</h3>
              <p className="text-sm text-red-700 mb-3">{message}</p>
              <div className="flex gap-2">
                {showReload && (
                  <button
                    onClick={this.handleReload}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reload
                  </button>
                )}
                {showHome && (
                  <button
                    onClick={this.handleGoHome}
                    className="text-xs px-3 py-1.5 rounded-md text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Go to Home
                  </button>
                )}
              </div>
            </div>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-red-600">Error Details</summary>
              <pre className="mt-2 p-2 bg-red-100 rounded overflow-auto max-h-32">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC wrapper for functional components
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Hook for programmatic error handling
 */
export function useErrorHandler() {
  const [error, setError] = React.useState(null);

  const handleError = React.useCallback((error) => {
    console.error('Hook error:', error);
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}

export default ErrorBoundary;