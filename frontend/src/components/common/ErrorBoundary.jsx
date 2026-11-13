import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 shadow-lg shadow-rose-500/10">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mb-6">
            An unexpected error occurred in NEXORA. Please reload the application or try again later.
          </p>
          {this.state.error?.message && (
            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400 font-mono max-w-lg mb-6 overflow-x-auto text-left shadow-subtle">
              {this.state.error.message}
            </div>
          )}
          <Button variant="primary" onClick={this.handleReload}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

