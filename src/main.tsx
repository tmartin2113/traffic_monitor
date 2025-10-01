/**
 * @file main.tsx
 * @description Application entry point for 511 Bay Area Traffic Monitor
 * @version 3.0.0
 * 
 * Responsibilities:
 * - Initialize React application
 * - Configure Leaflet for Vite/Webpack
 * - Set up error boundaries
 * - Configure performance monitoring
 * - Handle environment validation
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global styles
import './styles/globals.css';
import './styles/map.css';

// Leaflet styles - must be imported before components
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Leaflet imports for icon fix
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

/**
 * CRITICAL FIX: Leaflet default icon issue with Vite/Webpack
 * 
 * Leaflet's default icon paths don't work with module bundlers.
 * This fix ensures markers display correctly in production.
 */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/**
 * Root Error Boundary Component
 * 
 * Catches catastrophic errors that occur during React rendering.
 * Provides user-friendly error display with recovery options.
 */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('Root Error Boundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({ errorInfo });

    // Send to error tracking service in production
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
      console.error('Production error logged:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-lg shadow-xl p-8">
              {/* Error Icon */}
              <div className="flex items-center gap-4 mb-6">
                <div className="text-6xl">⚠️</div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Application Error
                  </h1>
                  <p className="text-gray-600 mt-2">
                    Something went wrong. Please try refreshing the page.
                  </p>
                </div>
              </div>

              {/* Error Message */}
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">
                  {this.state.error.message || 'An unexpected error occurred'}
                </p>
              </div>

              {/* Development Error Details */}
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="mb-6">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
                    🔍 Error Details (Development Only)
                  </summary>
                  <div className="p-4 bg-gray-50 rounded border border-gray-200">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">
                        Error Stack:
                      </h3>
                      <pre className="text-xs text-red-600 overflow-auto max-h-40 font-mono">
                        {this.state.error.stack}
                      </pre>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">
                        Component Stack:
                      </h3>
                      <pre className="text-xs text-gray-600 overflow-auto max-h-40 font-mono">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={this.handleReload}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  🔄 Refresh Page
                </button>
                <button
                  onClick={this.handleReset}
                  className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  ↩️ Try Again
                </button>
              </div>

              {/* Help Text */}
              <p className="mt-6 text-sm text-gray-500 text-center">
                If this problem persists, please{' '}
                <a
                  href="https://github.com/yourusername/511-traffic-monitor/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  report the issue
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Performance Monitoring Setup
 * 
 * Reports Web Vitals metrics in production for performance tracking.
 * Metrics: CLS, FID, FCP, LCP, TTFB
 */
const setupPerformanceMonitoring = () => {
  if (import.meta.env.PROD) {
    // Dynamic import to avoid loading in development
    import('web-vitals')
      .then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
        // Core Web Vitals
        onCLS((metric) => {
          console.log('CLS:', metric);
          // Send to analytics: gtag('event', 'web_vitals', { ...metric });
        });

        onFID((metric) => {
          console.log('FID:', metric);
        });

        onFCP((metric) => {
          console.log('FCP:', metric);
        });

        onLCP((metric) => {
          console.log('LCP:', metric);
        });

        onTTFB((metric) => {
          console.log('TTFB:', metric);
        });
      })
      .catch((error) => {
        console.warn('Failed to load web-vitals:', error);
      });
  }
};

/**
 * Environment Validation
 * 
 * Checks for required environment variables and warns if missing.
 * Only critical in production - development can run without API key for UI testing.
 */
const validateEnvironment = (): boolean => {
  const requiredVars = ['VITE_511_API_KEY'];
  const missingVars = requiredVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missingVars.length > 0) {
    if (import.meta.env.PROD) {
      console.error(
        '❌ Missing required environment variables:',
        missingVars.join(', ')
      );
      return false;
    } else {
      console.warn(
        '⚠️ Missing environment variables (OK in development):',
        missingVars.join(', ')
      );
    }
  }

  return true;
};

/**
 * Remove Loading Splash Screen
 * 
 * Removes the initial loading indicator once React has rendered.
 */
const removeLoadingSplash = () => {
  const loadingElement = document.querySelector('.app-loading');
  if (loadingElement) {
    loadingElement.classList.add('fade-out');
    setTimeout(() => {
      loadingElement.remove();
    }, 300); // Match CSS transition duration
  }
};

/**
 * Initialize Application
 * 
 * Main entry point that:
 * 1. Validates environment
 * 2. Gets root DOM element
 * 3. Creates React root
 * 4. Renders app with error boundary
 * 5. Sets up performance monitoring
 * 6. Removes loading splash
 */
const initializeApp = async (): Promise<void> => {
  try {
    console.log('🚀 Initializing 511 Traffic Monitor...');

    // Validate environment
    const isEnvValid = validateEnvironment();
    if (!isEnvValid && import.meta.env.PROD) {
      throw new Error('Required environment variables are missing');
    }

    // Get root element
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element (#root) not found in DOM');
    }

    // Create React root
    const root = ReactDOM.createRoot(rootElement);

    // Render application with error boundary
    root.render(
      <React.StrictMode>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
      </React.StrictMode>
    );

    // Setup performance monitoring
    setupPerformanceMonitoring();

    // Remove loading splash
    removeLoadingSplash();

    console.log('✅ Application initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);

    // Show fallback error UI
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        ">
          <div style="
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            text-align: center;
          ">
            <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
            <h1 style="color: #1a202c; margin-bottom: 12px; font-size: 24px;">
              Failed to Initialize
            </h1>
            <p style="color: #4a5568; margin-bottom: 24px;">
              ${error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            <button
              onclick="window.location.reload()"
              style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                font-weight: 500;
              "
              onmouseover="this.style.background='#2563eb'"
              onmouseout="this.style.background='#3b82f6'"
            >
              Reload Page
            </button>
          </div>
        </div>
      `;
    }
  }
};

/**
 * Global Error Handlers
 * 
 * Catch unhandled errors and promise rejections
 */
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Send to error tracking service
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Send to error tracking service
});

/**
 * Start the application when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded
  initializeApp();
}

/**
 * Hot Module Replacement (HMR) for development
 */
if (import.meta.hot) {
  import.meta.hot.accept();
}

/**
 * Service Worker Registration (Optional)
 * 
 * Uncomment to enable offline support via PWA
 */
/*
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration);
      })
      .catch((error) => {
        console.warn('⚠️ Service Worker registration failed:', error);
      });
  });
}
*/
