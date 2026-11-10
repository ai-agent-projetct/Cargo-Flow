import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Keeps one broken screen from blanking the whole application.
//
// Without a boundary, any render error anywhere under the router unmounts the
// entire tree: the sidebar, the header and every other page go with it, and
// the user sees a white page with nothing to click. That has happened here
// before — a detail page rendering an object, and a missing icon import both
// did it — so the shell is protected rather than trusted.
//
// `resetKey` is the route path. Changing it clears the error, so navigating
// away from the broken screen brings the app back without a reload.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Left in deliberately: in development this is the only place the
    // component stack survives, and it is what makes a blank screen
    // diagnosable.
    console.error('Screen failed to render:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                This screen could not be displayed
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                The rest of the application is still working — use the menu to
                carry on, or reload to try this screen again.
              </p>
              <p className="mt-3 text-xs font-mono text-red-700 break-words">
                {error.message || String(error)}
              </p>
              {process.env.NODE_ENV !== 'production' && info?.componentStack && (
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer">
                    Component stack
                  </summary>
                  <pre className="mt-2 text-[10px] text-slate-500 whitespace-pre-wrap max-h-56 overflow-auto">
                    {info.componentStack}
                  </pre>
                </details>
              )}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => this.setState({ error: null, info: null })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  <RefreshCw size={13} /> Try again
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Reload the page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
