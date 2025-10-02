/**
 * @file components/FilterPanel/ApiKeyInput.tsx
 * @description Production-ready API key input and management component
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Trash2,
  Info,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import clsx from 'clsx';

// Hook imports
import { useApiKeyManager } from '@hooks/useApiKeyManager';

/**
 * Props interface for ApiKeyInput component
 */
export interface ApiKeyInputProps {
  /** Callback when API key is successfully validated */
  onKeyValidated?: (key: string) => void;
  /** Callback when API key is removed */
  onKeyRemoved?: () => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show the component in compact mode */
  compact?: boolean;
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean;
}

/**
 * API key validation states
 */
type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

/**
 * Error types for better user feedback
 */
interface ValidationError {
  type: 'format' | 'api' | 'network' | 'rate-limit' | 'unknown';
  message: string;
  suggestion?: string;
}

/**
 * ApiKeyInput Component
 * 
 * Production-ready API key management with:
 * - Secure key input with show/hide toggle
 * - Real-time validation with detailed error messages
 * - Key storage in localStorage
 * - Copy to clipboard functionality
 * - Clear/remove key option
 * - Visual feedback for all states
 * - Help text and external links
 * - Accessibility features (ARIA labels, keyboard navigation)
 * - Rate limit awareness
 */
export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  onKeyValidated,
  onKeyRemoved,
  className,
  compact = false,
  autoFocus = false,
}) => {
  // State
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the API key manager hook
  const {
    apiKey,
    setApiKey,
    removeApiKey,
    isValidApiKey,
    isValidating: hookIsValidating,
    validateApiKey,
    error: hookError,
  } = useApiKeyManager();

  // Initialize input with stored key
  useEffect(() => {
    if (apiKey) {
      setInputValue(apiKey);
      setValidationState(isValidApiKey ? 'valid' : 'idle');
    }
  }, [apiKey, isValidApiKey]);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current && !apiKey) {
      inputRef.current.focus();
    }
  }, [autoFocus, apiKey]);

  // Sync hook validation state
  useEffect(() => {
    if (hookIsValidating) {
      setValidationState('validating');
    }
  }, [hookIsValidating]);

  /**
   * Parse validation error into user-friendly format
   */
  const parseValidationError = useCallback((error: any): ValidationError => {
    // Network errors
    if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      return {
        type: 'network',
        message: 'Cannot reach 511.org API',
        suggestion: 'Check your internet connection and try again.'
      };
    }

    // API authentication errors
    if (error?.statusCode === 401 || error?.code === 'UNAUTHORIZED') {
      return {
        type: 'api',
        message: 'Invalid API key',
        suggestion: 'Please check your key or request a new one from 511.org.'
      };
    }

    // Rate limit errors
    if (error?.statusCode === 429 || error?.code === 'RATE_LIMITED') {
      return {
        type: 'rate-limit',
        message: 'Rate limit reached',
        suggestion: 'Your API key is valid but has hit the rate limit. Try again in an hour.'
      };
    }

    // Format errors
    if (error?.message?.includes('format')) {
      return {
        type: 'format',
        message: 'Invalid key format',
        suggestion: 'API keys are typically 20-64 characters long and may contain letters, numbers, hyphens, and underscores.'
      };
    }

    // Generic errors
    return {
      type: 'unknown',
      message: error?.message || 'Failed to validate API key',
      suggestion: 'Please try again. If the problem persists, contact support.'
    };
  }, []);

  /**
   * Validate key format before API call
   */
  const isValidKeyFormat = useCallback((key: string): boolean => {
    if (!key || typeof key !== 'string') {
      return false;
    }
    
    const trimmedKey = key.trim();
    
    // Check length (511.org keys are typically 30-50 characters)
    if (trimmedKey.length < 20 || trimmedKey.length > 64) {
      return false;
    }
    
    // Check for valid characters (alphanumeric, hyphens, underscores)
    const keyPattern = /^[a-zA-Z0-9_-]+$/;
    return keyPattern.test(trimmedKey);
  }, []);

  /**
   * Handle input change with basic format validation
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setInputValue(value);
    setValidationState('idle');
    setValidationError(null);
    setShowSuccessBanner(false);
    
    // Clear any pending validation
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
  }, []);

  /**
   * Handle paste with cleanup
   */
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    setInputValue(pastedText);
    setValidationState('idle');
    setValidationError(null);
  }, []);

  /**
   * Handle key validation
   */
  const handleValidate = useCallback(async () => {
    const trimmedKey = inputValue.trim();
    
    // Clear previous errors
    setValidationError(null);

    // Check if empty
    if (!trimmedKey) {
      setValidationError({
        type: 'format',
        message: 'API key is required',
        suggestion: 'Please enter your 511.org API key.'
      });
      setValidationState('invalid');
      return;
    }

    // Check format first
    if (!isValidKeyFormat(trimmedKey)) {
      setValidationError({
        type: 'format',
        message: 'Invalid API key format',
        suggestion: 'API keys should be 20-64 characters and contain only letters, numbers, hyphens, and underscores.'
      });
      setValidationState('invalid');
      return;
    }

    // Validate with API
    setValidationState('validating');

    try {
      const isValid = await validateApiKey(trimmedKey);
      
      if (isValid) {
        // Success
        setApiKey(trimmedKey);
        setValidationState('valid');
        setShowSuccessBanner(true);
        onKeyValidated?.(trimmedKey);

        // Hide success banner after 3 seconds
        setTimeout(() => {
          setShowSuccessBanner(false);
        }, 3000);
      } else {
        // Validation returned false
        const error = parseValidationError(hookError);
        setValidationError(error);
        setValidationState('invalid');
      }
    } catch (err: any) {
      // Exception during validation
      const error = parseValidationError(err);
      setValidationError(error);
      setValidationState('invalid');
      
      console.error('API key validation error:', err);
    }
  }, [inputValue, isValidKeyFormat, validateApiKey, setApiKey, onKeyValidated, hookError, parseValidationError]);

  /**
   * Handle remove key
   */
  const handleRemoveKey = useCallback(() => {
    removeApiKey();
    setInputValue('');
    setValidationState('idle');
    setValidationError(null);
    setShowSuccessBanner(false);
    onKeyRemoved?.();
    
    // Focus input after removal
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [removeApiKey, onKeyRemoved]);

  /**
   * Handle toggle visibility
   */
  const handleToggleVisibility = useCallback(() => {
    setShowKey(prev => !prev);
  }, []);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = useCallback(async () => {
    if (!apiKey) return;

    try {
      await navigator.clipboard.writeText(apiKey);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy API key:', err);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = apiKey;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => {
          setCopySuccess(false);
        }, 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr);
      }
    }
  }, [apiKey]);

  /**
   * Handle Enter key press
   */
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleValidate();
    }
  }, [handleValidate]);

  /**
   * Open 511.org token page
   */
  const handleGetKey = useCallback(() => {
    window.open('https://511.org/open-data/token', '_blank', 'noopener,noreferrer');
  }, []);

  /**
   * Determine input border color based on state
   */
  const getBorderColor = () => {
    switch (validationState) {
      case 'valid':
        return 'border-green-500 focus:ring-green-500 focus:border-green-500';
      case 'invalid':
        return 'border-red-500 focus:ring-red-500 focus:border-red-500';
      case 'validating':
        return 'border-blue-500 focus:ring-blue-500 focus:border-blue-500';
      default:
        return 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = () => {
    switch (validationState) {
      case 'validating':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'valid':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'invalid':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  // If key is valid and not in compact mode, show success state
  if (validationState === 'valid' && !compact && !showSuccessBanner) {
    return (
      <div className={clsx('bg-white rounded-lg border border-green-200 shadow-sm', className)}>
        <div className="p-4">
          {/* Success Header */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                API Key Connected
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Your 511.org API key is validated and active.
              </p>

              {/* Masked Key Display */}
              <div className="bg-gray-50 rounded-md p-3 mb-3 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 truncate">
                    {showKey ? apiKey : `${'•'.repeat(Math.min(apiKey?.length || 0, 32))}...`}
                  </span>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      type="button"
                      onClick={handleToggleVisibility}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 hover:bg-gray-200 rounded transition-colors relative"
                      aria-label="Copy API key"
                    >
                      {copySuccess ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Key
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main input form
  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Key className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                511.org API Key
              </h3>
              <p className="text-xs text-gray-500">
                Required for accessing traffic data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp(prev => !prev)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Toggle help"
          >
            <Info className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Help Text */}
        {showHelp && (
          <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-sm text-blue-900 mb-2">
              Don't have an API key? Get one for free from 511.org:
            </p>
            <button
              type="button"
              onClick={handleGetKey}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
            >
              Request API Key
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Banner */}
        {showSuccessBanner && (
          <div className="mb-3 p-3 bg-green-50 rounded-md border border-green-200 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm font-medium text-green-900">
                API key validated successfully!
              </p>
            </div>
          </div>
        )}

        {/* Input Field */}
        <div className="relative mb-3">
          <input
            ref={inputRef}
            type={showKey ? 'text' : 'password'}
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            placeholder="Enter your 511.org API key"
            disabled={validationState === 'validating'}
            className={clsx(
              'w-full px-3 py-2 pr-24 text-sm rounded-md border transition-colors',
              'focus:outline-none focus:ring-2',
              'disabled:bg-gray-50 disabled:cursor-not-allowed',
              'font-mono',
              getBorderColor()
            )}
            aria-label="API key input"
            aria-invalid={validationState === 'invalid'}
            aria-describedby={validationError ? 'api-key-error' : undefined}
          />
          
          {/* Input Actions */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Status Icon */}
            {getStatusIcon()}
            
            {/* Toggle Visibility */}
            {inputValue && (
              <button
                type="button"
                onClick={handleToggleVisibility}
                disabled={validationState === 'validating'}
                className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4 text-gray-600" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-600" />
                )}
              </button>
            )}
            
            {/* Clear Input */}
            {inputValue && validationState !== 'validating' && (
              <button
                type="button"
                onClick={() => {
                  setInputValue('');
                  setValidationState('idle');
                  setValidationError(null);
                  inputRef.current?.focus();
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Clear input"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {validationError && (
          <div
            id="api-key-error"
            className="mb-3 p-3 bg-red-50 rounded-md border border-red-200"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900 mb-1">
                  {validationError.message}
                </p>
                {validationError.suggestion && (
                  <p className="text-sm text-red-700">
                    {validationError.suggestion}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleValidate}
            disabled={!inputValue.trim() || validationState === 'validating'}
            className={clsx(
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2',
              'text-sm font-medium text-white rounded-md',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              validationState === 'validating'
                ? 'bg-blue-400 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            )}
          >
            {validationState === 'validating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Validate Key
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleGetKey}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Get Key
          </button>
        </div>

        {/* Footer Help Text */}
        {!showHelp && (
          <p className="mt-3 text-xs text-gray-500 text-center">
            Your API key is stored locally and never sent to third parties
          </p>
        )}
      </div>
    </div>
  );
};

export default ApiKeyInput;
