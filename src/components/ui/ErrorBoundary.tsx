import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-stone-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>

            <h1 className="text-xl font-semibold text-stone-900 mb-2">Something went wrong</h1>
            <p className="text-stone-600 mb-6">
              The app encountered an unexpected error. Your data is safe. Please reload to continue.
            </p>

            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-stone-800 text-white rounded-full font-medium hover:bg-stone-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload App
            </button>

            {error && (
              <div className="mt-6">
                <button
                  onClick={this.toggleDetails}
                  className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 transition-colors"
                >
                  {showDetails ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show details
                    </>
                  )}
                </button>

                {showDetails && (
                  <div className="mt-4 text-left bg-stone-50 rounded-lg p-4 overflow-auto max-h-48">
                    <p className="text-sm font-mono text-red-600 mb-2">{error.message}</p>
                    {errorInfo?.componentStack && (
                      <pre className="text-xs font-mono text-stone-500 whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
