/**
 * @file utils/dateUtils.ts
 * @description Date utility functions for formatting and manipulation
 * @version 2.0.0 - ALL BUGS FIXED ✅
 * 
 * FIXES APPLIED:
 * ✅ BUG FIX #1: Replaced console.error in formatEventTime() with logger.error
 * ✅ BUG FIX #2: Replaced console.error in getRelativeTime() with logger.error
 * ✅ BUG FIX #3: Replaced console.error in isRecentEvent() with logger.error
 * ✅ BUG FIX #4: Replaced console.error in isStaleEvent() with logger.error
 * ✅ BUG FIX #5: Replaced console.error in isDateInRange() with logger.error
 * ✅ BUG FIX #6: Replaced console.error in getTimeElapsed() with logger.error
 * 
 * PRODUCTION STANDARDS:
 * - NO console.* statements (uses logger utility)
 * - Comprehensive error handling
 * - Type-safe throughout
 * - Uses date-fns for reliable date operations
 * - Fallback values for all errors
 * 
 * @author Senior Development Team
 * @since 2.0.0
 */

import {
  format,
  formatDistance,
  formatRelative,
  parseISO,
  isAfter,
  isBefore,
  isWithinInterval,
  addMinutes,
  addHours,
  addDays,
  subMinutes,
  subHours,
  subDays,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  isToday,
  isYesterday,
  isTomorrow,
  isThisWeek,
  isValid,
} from 'date-fns';
import { DATE_FORMATS } from './constants';
import { logger } from './logger';

// ============================================================================
// DATE FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format event time for display
 * FIXED BUG #1: Replaced console.error with logger.error
 * 
 * @param dateString - Date string or Date object
 * @param formatType - Format type from DATE_FORMATS
 * @returns Formatted date string
 */
export function formatEventTime(
  dateString: string | Date, 
  formatType: keyof typeof DATE_FORMATS = 'SHORT'
): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    
    if (!isValid(date)) {
      return 'Invalid date';
    }

    if (formatType === 'RELATIVE') {
      return formatRelative(date, new Date());
    }

    const formatString = DATE_FORMATS[formatType];
    return format(date, formatString);
  } catch (error) {
    // FIXED BUG #1: Replaced console.error with logger.error
    logger.error('Error formatting event date', {
      dateString: String(dateString),
      formatType,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'Invalid date';
  }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * FIXED BUG #2: Replaced console.error with logger.error
 * 
 * @param dateString - Date string or Date object
 * @returns Relative time string
 */
export function getRelativeTime(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    
    if (!isValid(date)) {
      return 'Unknown';
    }

    return formatDistance(date, new Date(), { addSuffix: true });
  } catch (error) {
    // FIXED BUG #2: Replaced console.error with logger.error
    logger.error('Error getting relative time', {
      dateString: String(dateString),
      error: error instanceof Error ? error.message : String(error),
    });
    return 'Unknown';
  }
}

/**
 * Get friendly date label (e.g., "Today at 3:45 PM")
 * 
 * @param dateString - Date string or Date object
 * @returns Friendly date label
 */
export function getFriendlyDateLabel(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    
    if (!isValid(date)) {
      return 'Invalid date';
    }

    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    }
    if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }
    if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, 'h:mm a')}`;
    }
    if (isThisWeek(date)) {
      return format(date, "EEEE 'at' h:mm a");
    }
    
    return format(date, 'MMM d, yyyy h:mm a');
  } catch (error) {
    logger.error('Error getting friendly date label', {
      dateString: String(dateString),
      error: error instanceof Error ? error.message : String(error),
    });
    return 'Invalid date';
  }
}

// ============================================================================
// DATE CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if event is recent (within last N minutes)
 * FIXED BUG #3: Replaced console.error with logger.error
 * 
 * @param dateString - Date string or Date object
 * @param thresholdMinutes - Threshold in minutes (default: 30)
 * @returns True if event is recent
 */
export function isRecentEvent(
  dateString: string | Date, 
  thresholdMinutes = 30
): boolean {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    
    if (!isValid(date)) {
      return false;
    }

    const threshold = subMinutes(new Date(), thresholdMinutes);
    return isAfter(date, threshold);
  } catch (error) {
    // FIXED BUG #3: Replaced console.error with logger.error
    logger.error('Error checking if event is recent', {
      dateString: String(dateString),
      thresholdMinutes,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Check if event is stale (older than specified hours)
 * FIXED BUG #4: Replaced console.error with logger.error
 * 
 * @param dateString - Date string or Date object
 * @param thresholdHours - Threshold in hours (default: 24)
 * @returns True if event is stale
 */
export function isStaleEvent(
  dateString: string | Date, 
  thresholdHours = 24
): boolean {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    
    if (!isValid(date)) {
      return true;
    }

    const threshold = subHours(new Date(), thresholdHours);
    return isBefore(date, threshold);
  } catch (error) {
    // FIXED BUG #4: Replaced console.error with logger.error
    logger.error('Error checking if event is stale', {
      dateString: String(dateString),
      thresholdHours,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/**
 * Check if date is within range
 * FIXED BUG #5: Replaced console.error with logger.error
 * 
 * @param date - Date to check
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @returns True if date is within range
 */
export function isDateInRange(
  date: string | Date,
  startDate: string | Date,
  endDate: string | Date
): boolean {
  try {
    const checkDate = typeof date === 'string' ? parseISO(date) : date;
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(checkDate) || !isValid(start) || !isValid(end)) {
      return false;
    }

    return isWithinInterval(checkDate, { start, end });
  } catch (error) {
    // FIXED BUG #5: Replaced console.error with logger.error
    logger.error('Error checking if date is in range', {
      date: String(date),
      startDate: String(startDate),
      endDate: String(endDate),
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Check if date string represents today
 */
export function isDateToday(dateString: string | Date): boolean {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) && isToday(date);
  } catch {
    return false;
  }
}

/**
 * Check if date string represents yesterday
 */
export function isDateYesterday(dateString: string | Date): boolean {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) && isYesterday(date);
  } catch {
    return false;
  }
}

/**
 * Check if date string represents tomorrow
 */
export function isDateTomorrow(dateString: string | Date): boolean {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) && isTomorrow(date);
  } catch {
    return false;
  }
}

/**
 * Check if date is this week
 */
export function isDateThisWeek(dateString: string | Date): boolean {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) && isThisWeek(date);
  } catch {
    return false;
  }
}

// ============================================================================
// TIME CALCULATION FUNCTIONS
// ============================================================================

/**
 * Get time elapsed since date
 * FIXED BUG #6: Replaced console.error with logger.error
 * 
 * @param dateString - Date string or Date object
 * @returns Object with minutes, hours, days, and formatted string
 */
export function getTimeElapsed(dateString: string | Date): {
  minutes: number;
  hours: number;
  days: number;
  formatted: string;
} {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    
    if (!isValid(date)) {
      return { minutes: 0, hours: 0, days: 0, formatted: 'Unknown' };
    }

    const now = new Date();
    const minutes = differenceInMinutes(now, date);
    const hours = differenceInHours(now, date);
    const days = differenceInDays(now, date);

    let formatted: string;
    if (minutes < 1) {
      formatted = 'Just now';
    } else if (minutes < 60) {
      formatted = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      formatted = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      formatted = `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    return { minutes, hours, days, formatted };
  } catch (error) {
    // FIXED BUG #6: Replaced console.error with logger.error
    logger.error('Error getting time elapsed', {
      dateString: String(dateString),
      error: error instanceof Error ? error.message : String(error),
    });
    return { minutes: 0, hours: 0, days: 0, formatted: 'Unknown' };
  }
}

/**
 * Calculate time until a future date
 * 
 * @param dateString - Date string or Date object
 * @returns Object with time until date, or null if date is in past
 */
export function getTimeUntil(dateString: string | Date): {
  minutes: number;
  hours: number;
  days: number;
  formatted: string;
} | null {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    
    if (!isValid(date)) {
      return null;
    }

    const now = new Date();
    
    if (isBefore(date, now)) {
      return null; // Date is in the past
    }

    const minutes = differenceInMinutes(date, now);
    const hours = differenceInHours(date, now);
    const days = differenceInDays(date, now);

    let formatted: string;
    if (minutes < 1) {
      formatted = 'Now';
    } else if (minutes < 60) {
      formatted = `In ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      formatted = `In ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      formatted = `In ${days} day${days !== 1 ? 's' : ''}`;
    }

    return { minutes, hours, days, formatted };
  } catch (error) {
    logger.error('Error calculating time until date', {
      dateString: String(dateString),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse schedule time string (e.g., "14:30")
 * 
 * @param timeString - Time string in HH:MM format
 * @returns Object with hours and minutes, or null if invalid
 */
export function parseScheduleTime(timeString: string): { hours: number; minutes: number } | null {
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  
  if (!match) {
    return null;
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * Format duration in milliseconds to human readable
 * 
 * @param milliseconds - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Get date range presets
 * 
 * @returns Object with common date range presets
 */
export function getDateRangePresets() {
  const now = new Date();
  
  return {
    today: {
      label: 'Today',
      start: startOfDay(now),
      end: endOfDay(now),
    },
    yesterday: {
      label: 'Yesterday',
      start: startOfDay(subDays(now, 1)),
      end: endOfDay(subDays(now, 1)),
    },
    thisWeek: {
      label: 'This Week',
      start: startOfWeek(now),
      end: endOfWeek(now),
    },
    last7Days: {
      label: 'Last 7 Days',
      start: startOfDay(subDays(now, 7)),
      end: endOfDay(now),
    },
    last30Days: {
      label: 'Last 30 Days',
      start: startOfDay(subDays(now, 30)),
      end: endOfDay(now),
    },
    custom: {
      label: 'Custom Range',
      start: null,
      end: null,
    },
  };
}

/**
 * Sort dates in ascending order
 * 
 * @param dates - Array of date strings or Date objects
 * @returns Array of Date objects sorted ascending
 */
export function sortDatesAscending(dates: (string | Date)[]): Date[] {
  return dates
    .map(d => typeof d === 'string' ? parseISO(d) : d)
    .filter(d => isValid(d))
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Sort dates in descending order
 * 
 * @param dates - Array of date strings or Date objects
 * @returns Array of Date objects sorted descending
 */
export function sortDatesDescending(dates: (string | Date)[]): Date[] {
  return dates
    .map(d => typeof d === 'string' ? parseISO(d) : d)
    .filter(d => isValid(d))
    .sort((a, b) => b.getTime() - a.getTime());
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  formatEventTime,
  getRelativeTime,
  getFriendlyDateLabel,
  isRecentEvent,
  isStaleEvent,
  isDateInRange,
  isDateToday,
  isDateYesterday,
  isDateTomorrow,
  isDateThisWeek,
  getTimeElapsed,
  getTimeUntil,
  parseScheduleTime,
  formatDuration,
  getDateRangePresets,
  sortDatesAscending,
  sortDatesDescending,
};
