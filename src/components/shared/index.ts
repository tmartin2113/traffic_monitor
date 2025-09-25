/**
 * Shared Components Barrel Export
 * Central export point for all shared components
 * 
 * @module src/shared/index
 * @version 1.0.0
 */

// ============================================
// Component Exports
// ============================================

// Error Handling Components
export { 
  ErrorAlert,
  ErrorSeverity,
  ErrorType,
  type ErrorAlertProps 
} from './ErrorAlert';

// Loading State Components
export { 
  LoadingSpinner,
  SpinnerSize,
  SpinnerVariant,
  Skeleton,
  ProgressBar,
  type LoadingSpinnerProps,
  type SkeletonProps,
  type ProgressBarProps
} from './LoadingSpinner';

// Badge Component
export { Badge, type BadgeProps } from './Badge';

// Button Component
export { Button, type ButtonProps } from './Button';

// Modal Components
export { Modal, type ModalProps } from './Modal';

// Toast Components
export { Toast, showToast, type ToastProps } from './Toast';

// Input Components
export { Input, type InputProps } from './Input';
export { Select, type SelectProps } from './Select';
export { Checkbox, type CheckboxProps } from './Checkbox';

// Card Components
export { Card, CardHeader, CardContent, CardFooter, type CardProps } from './Card';

// Tooltip Component
export { Tooltip, type TooltipProps } from './Tooltip';

// ============================================
// Type-only exports for commonly used types
// ============================================

export type {
  // Common prop types
  BaseComponentProps,
  StyleVariant,
  SizeVariant,
  ColorVariant,
} from './types';

// ============================================
// Utility exports
// ============================================

export { cn, clsx } from './utils';

// ============================================
// Hooks exports
// ============================================

export { useDebounce } from './hooks/useDebounce';
export { useOnClickOutside } from './hooks/useOnClickOutside';
export { useMediaQuery } from './hooks/useMediaQuery';
export { usePrevious } from './hooks/usePrevious';

// ============================================
// Constants exports
// ============================================

export * from './constants';

// ============================================
// Re-export commonly used third-party components
// ============================================

export type { LucideIcon } from 'lucide-react';
