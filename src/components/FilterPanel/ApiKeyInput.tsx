/**
 * ApiKeyInput Component
 * Input field for entering 511.org API key
 */

import React, { useState } from 'react';
import { Key, ExternalLink, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

interface ApiKeyInputProps {
  onSubmit: (key: string) => void;
  compact?: boolean;
  showInstructions?: boolean;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  onSubmit,
  compact = false,
  showInstructions = true,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  const validateApiKey = (key: string): boolean => {
    // Basic validation - API keys are typically alphanumeric
    const keyPattern = /^[a-zA-Z0-9]{20,}$/;
    return keyPattern.test(key.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedKey = apiKey.trim();
    
    if (!trimmedKey) {
      setError('Please enter an API key');
      return;
    }
    
    if (!validateApiKey(trimmedKey)) {
      setError('Invalid API key format');
      return;
    }
    
    setError('');
    onSubmit(trimmedKey);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    if (error) setError('');
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Key className="h-4 w-4 text-yellow-600" />
          </div>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={handleKeyChange}
            placeholder="Enter API key"
            className={clsx(
              "w-full pl-9 pr-20 py-2 border rounded-md text-sm",
              "focus:outline-none focus:ring-2 focus:ring-yellow-500",
              error ? "border-red-300" : "border-yellow-300"
            )}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 space-x-1">
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="submit"
              className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
            >
              Set
            </button>
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
        <a
          href="https://511.org/open-data/token"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 text-xs text-yellow-700 hover:text-yellow-800"
        >
          <span>Get API key</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </form>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Key className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">API Key Required</h3>
          <p className="text-sm text-gray-600">Enter your 511.org API key to continue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <div className="relative">
            <input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleKeyChange}
              placeholder="Enter your 511.org API key"
              className={clsx(
                "w-full px-3 py-2 pr-10 border rounded-md",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                error ? "border-red-300" : "border-gray-300"
              )}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showKey ? (
                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              )}
            </button>
          </div>
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>

        {showInstructions && (
          <div className="bg-blue-50 rounded-md p-3 text-sm">
            <p className="text-blue-900 font-medium mb-1">How to get an API key:</p>
            <ol className="list-decimal list-inside text-blue-800 space-y-1">
              <li>Visit the 511.org Open Data portal</li>
              <li>Click "Request Token"</li>
              <li>Fill out the registration form</li>
              <li>Check your email for the API key</li>
            </ol>
          </div>
        )}

        <div className="flex items-center justify-between">
          <a
            href="https://511.org/open-data/token"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <span>Get API key</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="submit"
            disabled={!apiKey.trim()}
            className={clsx(
              "px-4 py-2 rounded-md font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              apiKey.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
};
