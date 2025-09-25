/**
 * LoadingSpinner Component
 * Production-ready loading state indicator with multiple variants
 * 
 * @module src/shared/LoadingSpinner
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2, CircleNotch, Loader } from 'lucide-react';
import clsx from 'clsx';

/**
 * Loading spinner size variants
 */
export enum SpinnerSize {
  XS = 'xs',
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  XL = 'xl'
}

/**
 * Loading spinner variants for different visual styles
 */
export enum SpinnerVariant {
  DEFAULT = 'default',
  DOTS = 'dots',
  PULSE = 'pulse',
  BARS = 'bars',
  RING = 'ring'
}

/**
 * Props interface for LoadingSpinner component
 */
export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Visual variant of the spinner */
  variant?: SpinnerVariant;
  /** Color theme for the spinner */
  color?: 'primary' | 'secondary' | 'white' | 'dark' | 'auto';
  /** Loading text to display */
  text?: string;
  /** Whether to show the text below the spinner */
  textPosition?: 'below' | 'beside' | 'none';
  /** Whether to center the spinner in its container */
  center?: boolean;
  /** Whether to show a fullscreen overlay */
  fullScreen?: boolean;
  /** Whether to show a semi-transparent overlay behind the spinner */
  overlay?: boolean;
  /** Delay before showing the spinner (prevents flash for quick loads) */
  delayMs?: number;
  /** Additional CSS classes */
  className?: string;
  /** Container CSS classes */
  containerClassName?: string;
  /** Test ID for testing */
  testId?: string;
  /** Accessibility label */
  ariaLabel?: string;
}

/**
 * Size configuration mapping
 */
const sizeConfig = {
  [SpinnerSize.XS]: {
    spinner: 'w-3 h-3',
    text: 'text-xs',
    gap: 'gap-1'
  },
  [SpinnerSize.SM]: {
    spinner: 'w-4 h-4',
    text: 'text-sm',
    gap: 'gap-1.5'
  },
  [SpinnerSize.MD]: {
    spinner: 'w-6 h-6',
    text: 'text-sm',
    gap: 'gap-2'
  },
  [SpinnerSize.LG]: {
    spinner: 'w-8 h-8',
    text: 'text-base',
    gap: 'gap-2.5'
  },
  [SpinnerSize.XL]: {
    spinner: 'w-12 h-12',
    text: 'text-lg',
    gap: 'gap-3'
  }
};

/**
 * Color configuration mapping
 */
const colorConfig = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  white: 'text-white',
  dark: 'text-gray-900',
  auto: 'text-current'
};

/**
 * Default spinner component (rotating circle)
 */
const DefaultSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <Loader2 className={clsx('animate-spin', className)} />
);

/**
 * Dots variant spinner component
 */
const DotsSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('flex items-center', className)}>
    {[0, 1, 2].map((index) => (
      <div
        key={index}
        className={clsx(
          'rounded-full bg-current',
          'animate-pulse',
          className
        )}
        style={{
          width: '0.75em',
          height: '0.75em',
          margin: '0 0.125em',
          animationDelay: `${index * 150}ms`
        }}
      />
    ))}
  </div>
);

/**
 * Pulse variant spinner component
 */
const PulseSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('relative', className)}>
    <div className="absolute inset-0 rounded-full bg-current opacity-75 animate-ping" />
    <div className="relative rounded-full bg-current" style={{ width: '100%', height: '100%' }} />
  </div>
);

/**
 * Bars variant spinner component
 */
const BarsSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('flex items-end space-x-1', className)} style={{ height: '1.5em' }}>
    {[0, 1, 2, 3].map((index) => (
      <div
        key={index}
        className="bg-current animate-pulse rounded-sm"
        style={{
          width: '0.2em',
          height: '100%',
          animationDelay: `${index * 100}ms`,
          animationDuration: '0.6s'
        }}
      />
    ))}
  </div>
);

/**
 * Ring variant spinner component
 */
const RingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('relative', className)}>
    <svg
      className="animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      style={{ width: '100%', height: '100%' }}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
);

/**
 * Get the appropriate spinner component based on variant
 */
const getSpinnerComponent = (variant: SpinnerVariant, className?: string): React.ReactNode => {
  switch (variant) {
    case SpinnerVariant.DOTS:
      return <DotsSpinner className={className} />;
    case SpinnerVariant.PULSE:
      return <PulseSpinner className={className} />;
    case SpinnerVariant.BARS:
      return <BarsSpinner className={className} />;
    case SpinnerVariant.RING:
      return <RingSpinner className={className} />;
    default:
      return <DefaultSpinner className={className} />;
  }
};

/**
 * Production-ready loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = SpinnerSize.MD,
  variant = SpinnerVariant.DEFAULT,
  color = 'primary',
  text,
  textPosition = 'below',
  center = false,
  fullScreen = false,
  overlay = false,
  delayMs = 0,
  className,
  containerClassName,
  testId = 'loading-spinner',
  ariaLabel = 'Loading...'
}) => {
  const [isVisible, setIsVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs > 0) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delayMs);

      return () => clearTimeout(timer);
    }
  }, [delayMs]);

  if (!isVisible) return null;

  const sizeStyles = sizeConfig[size];
  const colorStyle = colorConfig[color];

  const spinnerElement = (
    <div
      data-testid={testId}
      role="status"
      aria-label={ariaLabel}
      className={clsx(
        'inline-flex items-center',
        sizeStyles.gap,
        textPosition === 'below' && 'flex-col',
        textPosition === 'beside' && 'flex-row',
        center && 'justify-center',
        className
      )}
    >
      <div className={clsx(sizeStyles.spinner, colorStyle)}>
        {getSpinnerComponent(variant, 'w-full h-full')}
      </div>
      
      {text && textPosition !== 'none' && (
        <span className={clsx(sizeStyles.text, colorStyle, 'font-medium')}>
          {text}
        </span>
      )}
      
      {/* Screen reader only text */}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );

  // Fullscreen overlay
  if (fullScreen) {
    return (
      <div
        className={clsx(
          'fixed inset-0 z-50 flex items-center justify-center',
          'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm',
          containerClassName
        )}
      >
        {spinnerElement}
      </div>
    );
  }

  // Regular overlay
  if (overlay) {
    return (
      <div
        className={clsx(
          'absolute inset-0 z-10 flex items-center justify-center',
          'bg-white/75 dark:bg-gray-900/75 backdrop-blur-sm rounded-lg',
          containerClassName
        )}
      >
        {spinnerElement}
      </div>
    );
  }

  // Centered container
  if (center) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center w-full h-full',
          containerClassName
        )}
      >
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
};

/**
 * Skeleton loader for content placeholders
 */
export interface SkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Shape of the skeleton */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  /** Whether to animate the skeleton */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Number of skeleton lines for text variant */
  lines?: number;
  /** Test ID for testing */
  testId?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1em',
  variant = 'text',
  animate = true,
  className,
  lines = 1,
  testId = 'skeleton-loader'
}) => {
  const baseStyles = clsx(
    'bg-gray-200 dark:bg-gray-700',
    animate && 'animate-pulse',
    className
  );

  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg'
  };

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2" data-testid={testId}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={clsx(baseStyles, variantStyles[variant])}
            style={{
              ...style,
              width: index === lines - 1 ? '80%' : style.width
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className={clsx(baseStyles, variantStyles[variant])}
      style={style}
    />
  );
};

/**
 * Progress bar component for determinate loading states
 */
export interface ProgressBarProps {
  /** Current progress value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Whether to show the percentage text */
  showValue?: boolean;
  /** Size of the progress bar */
  size?: 'sm' | 'md' | 'lg';
  /** Color of the progress bar */
  color?: 'primary' | 'success' | 'warning' | 'danger';
  /** Whether to animate the progress bar */
  animate?: boolean;
  /** Whether to show stripes */
  striped?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showValue = false,
  size = 'md',
  color = 'primary',
  animate = true,
  striped = false,
  className,
  testId = 'progress-bar'
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-4'
  };

  const colorStyles = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600'
  };

  return (
    <div className={clsx('w-full', className)} data-testid={testId}>
      <div className={clsx('relative overflow-hidden bg-gray-200 rounded-full', sizeStyles[size])}>
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            colorStyles[color],
            animate && 'duration-300 ease-out',
            striped && 'bg-stripes animate-stripes'
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showValue && (
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 text-center">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
