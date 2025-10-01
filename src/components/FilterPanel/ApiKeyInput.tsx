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
  Shield
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
 * ApiKeyInput Component
 * 
 * Production-ready API key management with:
 * - Secure key input with show/hide toggle
 * - Real-time validation
 * - Key storage in localStorage
 * - Copy to clipboard functionality
 * - Clear/remove key option
 * - Visual feedback for all states
 * - Help text and external links
 * - Accessibility features
 */
export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  onKeyValidated,
  onKeyRemoved,
  className,
  compact = false,
  autoFocus = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [showSuccess, setShowSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use the API key manager hook
  const {
    apiKey,
    setApiKey,
    removeApiKey,
    isValidApiKey,
    isValidating,
    validateApiKey,
    error,
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

  // Update validation state based on hook state
  useEffect(() => {
    if (isValidating) {
      setValidationState('validating');
    } else if (isValidApiKey) {
      setValidationState('valid');
    } else if (error) {
      setValidationState('invalid');
    }
  }, [isValidating, isValidApiKey, error]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setInputValue(value);
    setValidationState('idle');
    setShowSuccess(false);
  }, []);

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    setInputValue(pastedText);
    setValidationState('idle');
  }, []);

  // Handle key validation
  const handleValidate = useCallback(async () => {
    if (!inputValue || inputValue.length < 10) {
      setValidationState('invalid');
      return;
    }

    setValidationState('validating');

    try {
      const isValid = await validateApiKey(inputValue);
      
      if (isValid) {
        setApiKey(inputValue);
        setValidationState('valid');
        setShowSuccess(true);
        onKeyValidated?.(inputValue);

        // Hide success message after 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      } else {
        setValidationState('invalid');
      }
    } catch (err) {
      setValidationState('invalid');
    }
  }, [inputValue, validateApiKey, setApiKey, onKeyValidated]);

  // Handle remove key
  const handleRemoveKey = useCallback(() => {
    removeApiKey();
    setInputValue('');
    setValidationState('idle');
    setShowSuccess(false);
    onKeyRemoved?.();
    
    // Focus input after removal
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [removeApiKey, onKeyRemoved]);

  // Handle toggle visibility
  const handleToggleVisibility = useCallback(() => {
    setShowKey(!showKey);
  }, [showKey]);

  // Handle copy to clipboard
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
    }
  }, [apiKey]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleValidate();
    }
  }, [handleValidate]);

  // Open 511.org token page
  const handleGetKey = useCallback(() => {
    window.open('https://511.org/open-data/token', '_blank', 'noopener,noreferrer');
  }, []);

  // Determine input border color based on state
  const getBorderColor = () => {
    switch (validationState) {
      case 'valid':
        return 'border-green-500 focus:ring-green-500';
      case 'invalid':
        return 'border-red-500 focus:ring-red-500';
      case 'validating':
        return 'border-blue-500 focus:ring-blue-500';
      default:
        return 'border-gray-300 focus:ring-blue-500';
    }
  };

  // If key is valid and not in compact mode, show success state
  if (validationState === 'valid' && !compact && !showSuccess) {
    return (
      <div className={clsx('bg-white rounded-lg border border-green-200', className)}>
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
              <p className="text-sm text-gray-600">
                Your 511.org API key is validated and active.
              </p>
            </div>
          </div>

          {/* Key Display */}
          <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <code className="flex-1 text-xs font-mono text-gray-700 truncate">
                {showKey ? apiKey : apiKey?.replace(/./g, '•')}
              </code>
              <button
                onClick={handleToggleVisibility}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4 text-gray-600" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
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

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRemoveKey}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove Key
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200', className)}>
      <div className={clsx(compact ? 'p-3' : 'p-4')}>
        {/* Header */}
        {!compact && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                511.org API Key
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              Enter your API key to access real-time traffic data.
            </p>
          </div>
        )}

        {/* Input Field */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Key className="w-4 h-4 text-gray-400" />
            </div>
            <input
              ref={inputRef}
              type={showKey ? 'text' : 'password'}
              value={inputValue}
              onChange={handleInputChange}
              onPaste={handlePaste}
              onKeyPress={handleKeyPress}
              placeholder="Enter your API key..."
              disabled={validationState === 'validating'}
              className={clsx(
                'w-full pl-10 pr-24 py-2.5 text-sm font-mono rounded-lg transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-offset-0',
                'disabled:bg-gray-50 disabled:cursor-not-allowed',
                getBorderColor()
              )}
              aria-label="API key input"
              aria-describedby="api-key-help"
            />
            
            {/* Input Actions */}
            <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
              {inputValue && (
                <button
                  onClick={() => setInputValue('')}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Clear input"
                  disabled={validationState === 'validating'}
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <button
                onClick={handleToggleVisibility}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                disabled={validationState === 'validating'}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Validation Status */}
          {validationState === 'validating' && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Validating API key...</span>
            </div>
          )}

          {validationState === 'valid' && showSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              <span>API key validated successfully!</span>
            </div>
          )}

          {validationState === 'invalid' && error && (
            <div className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleValidate}
              disabled={!inputValue || validationState === 'validating'}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-blue-600 text-white hover:bg-blue-700',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
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

            {apiKey && (
              <button
                onClick={handleRemoveKey}
                disabled={validationState === 'validating'}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
                  'border border-gray-300 text-gray-700 hover:bg-gray-50',
                  'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Help Section */}
        {!compact && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-start gap-2 text-sm text-gray-600 mb-3">
              <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p id="api-key-help">
                Your API key is stored securely in your browser and never shared with third parties.
              </p>
            </div>

            <button
              onClick={handleGetKey}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-4 h-4" />
              Get a free API key from 511.org
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyInput;
