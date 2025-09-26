/**
 * Application Entry Point
 * 
 * @module main
 * @description Bootstraps the React application with all necessary providers and configurations.
 * Handles initial setup, error boundaries, and performance monitoring.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/map.css';

// Import Leaflet CSS globally (if not loaded via CDN)
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix Leaflet default icon issue with Vite
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Configure Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/**
 * Error Boundary Component
 * Catches and displays errors gracefully
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo);
    
    // Send error to monitoring service if configured
    if (import.meta.env.VITE_SENTRY_DSN) {
      // Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full space-y-8 text-center">
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                We encountered an unexpected error. Please refresh the page to try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500">
                    Error details (Development only)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Performance monitoring
 */
if (import.meta.env.PROD && 'reportWebVitals' in window) {
  // Report Web Vitals for performance monitoring
  import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
    onCLS(console.log);
    onFID(console.log);
    onFCP(console.log);
    onLCP(console.log);
    onTTFB(console.log);
  });
}

/**
 * Check for required environment variables
 */
const checkEnvironment = (): void => {
  const requiredEnvVars = ['VITE_511_API_KEY'];
  const missingVars = requiredEnvVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missingVars.length > 0 && import.meta.env.PROD) {
    console.warn(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
};

/**
 * Initialize application
 */
const initializeApp = async (): Promise<void> => {
  try {
    // Check environment
    checkEnvironment();

    // Get root element
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    // Create React root and render
    const root = ReactDOM.createRoot(rootElement);
    
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );

    // Remove loading state
    const loadingElement = document.querySelector('.app-loading');
    if (loadingElement) {
      loadingElement.remove();
    }

    // Log successful initialization
    console.log(
      '%c🚗 511 Bay Area Traffic Monitor initialized successfully',
      'color: #3b82f6; font-weight: bold; font-size: 14px;'
    );

    // Display version info in development
    if (import.meta.env.DEV) {
      console.log(
        `%cVersion: ${import.meta.env.VITE_BUILD_VERSION || '1.0.0-dev'}`,
        'color: #6b7280; font-size: 12px;'
      );
      console.log(
        `%cEnvironment: ${import.meta.env.MODE}`,
        'color: #6b7280; font-size: 12px;'
      );
    }
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Display error message
    document.getElementById('root')!.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: system-ui, sans-serif;">
        <h1>Failed to load application</h1>
        <p>Please check your internet connection and try refreshing the page.</p>
        <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">
          Refresh Page
        </button>
      </div>
    `;
  }
};

// Start the application
initializeApp();
