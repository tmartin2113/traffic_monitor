/**
 * Date Utility Functions
 * Helper functions for date and time operations
 */

import { 
  format, 
  formatDistanceToNow, 
  parseISO, 
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  isToday,
  isYesterday,
  isThisWeek,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  isBefore,
  isAfter,
  isValid
} from 'date-fns';

/**
 * Format a date string to a readable format
 */
export function formatDate(dateString: string, formatString: string = 'MMM d, yyyy'): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'Invalid date';
    return format(date, formatString);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date with time
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'Invalid date';
    
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else if (isThisWeek(date)) {
      return format(date, 'EEEE at h:mm a');
    } else {
      return format(date, 'MMM d, yyyy at h:mm a');
    }
  } catch {
    return 'Invalid date';
  }
}

/**
 * Get relative time from now
 */
export function getRelativeTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'Unknown time';
    
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, date);
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return formatDistanceToNow(date, { addSuffix: true });
    }
  } catch {
    return 'Unknown time';
  }
}

/**
 * Get short relative time
 */
export function getShortRelativeTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'N/A';
    
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, date);
    const diffHours = differenceInHours(now, date);
    const diffDays = differenceInDays(now, date);
    
    if (diffMinutes < 1) {
      return 'now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return format(date, 'MM/dd');
    }
  } catch {
    return 'N/A';
  }
}

/**
 * Check if date is recent (within threshold)
 */
export function isRecent(dateString: string, thresholdMinutes: number = 30): boolean {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return false;
    
    const now = new Date();
    return differenceInMinutes(now, date) <= thresholdMinutes;
  } catch {
    return false;
  }
}

/**
 * Check if date is stale (older than threshold)
 */
export function isStale(dateString: string, thresholdHours: number = 24): boolean {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return true;
    
    const now = new Date();
    return differenceInHours(now, date) > thresholdHours;
  } catch {
    return true;
  }
}

/**
 * Get date range for filtering
 */
export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export function getPresetDateRanges(): DateRange[] {
  const now = new Date();
  
  return [
    {
      start: subDays(startOfDay(now), 0),
      end: endOfDay(now),
      label: 'Today',
    },
    {
      start: subDays(startOfDay(now), 1),
      end: endOfDay(subDays(now, 1)),
      label: 'Yesterday',
    },
    {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
      label: 'This Week',
    },
    {
      start: subDays(now, 7),
      end: now,
      label: 'Last 7 Days',
    },
    {
      start: subDays(now, 30),
      end: now,
      label: 'Last 30 Days',
    },
  ];
}

/**
 * Check if date is within range
 */
export function isWithinDateRange(
  dateString: string, 
  range: { start?: Date; end?: Date }
): boolean {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return false;
    
    if (range.start && isBefore(date, range.start)) {
      return false;
    }
    
    if (range.end && isAfter(date, range.end)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Format duration between two dates
 */
export function formatDuration(startDate: string, endDate?: string): string {
  try {
    const start = parseISO(startDate);
    const end = endDate ? parseISO(endDate) : new Date();
    
    if (!isValid(start) || !isValid(end)) {
      return 'Unknown duration';
    }
    
    const diffMinutes = differenceInMinutes(end, start);
    const diffHours = differenceInHours(end, start);
    const diffDays = differenceInDays(end, start);
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }
  } catch {
    return 'Unknown duration';
  }
}

/**
 * Parse schedule string (e.g., "Mon-Fri 9AM-5PM")
 */
export interface Schedule {
  days: string[];
  startTime: string;
  endTime: string;
}

export function parseScheduleString(schedule: string): Schedule | null {
  try {
    // Example: "Mon-Fri 9AM-5PM" or "Daily 10PM-6AM"
    const match = schedule.match(/^([\w-]+)\s+(\d{1,2}(?::\d{2})?\s*[AP]M)-(\d{1,2}(?::\d{2})?\s*[AP]M)$/i);
    
    if (!match) return null;
    
    const [, daysStr, startTime, endTime] = match;
    
    let days: string[] = [];
    
    if (daysStr.toLowerCase() === 'daily') {
      days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else if (daysStr.includes('-')) {
      // Parse range like "Mon-Fri"
      const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const [startDay, endDay] = daysStr.split('-');
      const startIndex = allDays.findIndex(d => d.startsWith(startDay.substring(0, 3)));
      const endIndex = allDays.findIndex(d => d.startsWith(endDay.substring(0, 3)));
      
      if (startIndex >= 0 && endIndex >= 0) {
        days = allDays.slice(startIndex, endIndex + 1);
      }
    } else {
      // Single day or comma-separated days
      days = daysStr.split(',').map(d => d.trim());
    }
    
    return {
      days,
      startTime: startTime.toUpperCase(),
      endTime: endTime.toUpperCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Check if current time is within schedule
 */
export function isWithinSchedule(schedule: Schedule): boolean {
  const now = new Date();
  const currentDay = format(now, 'EEE');
  
  if (!schedule.days.includes(currentDay)) {
    return false;
  }
  
  // Parse times
  const currentTime = format(now, 'h:mm A');
  const parseTime = (timeStr: string): number => {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes = '0'] = time.split(':').map(Number);
    let totalMinutes = hours * 60 + Number(minutes);
    
    if (period === 'PM' && hours !== 12) {
      totalMinutes += 12 * 60;
    }
    if (period === 'AM' && hours === 12) {
      totalMinutes -= 12 * 60;
    }
    
    return totalMinutes;
  };
  
  const current = parseTime(currentTime);
  const start = parseTime(schedule.startTime);
  const end = parseTime(schedule.endTime);
  
  // Handle overnight schedules
  if (end < start) {
    return current >= start || current <= end;
  }
  
  return current >= start && current <= end;
}

/**
 * Group events by time period
 */
export function groupEventsByTimePeriod<T extends { updated: string }>(
  events: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  events.forEach(event => {
    const date = parseISO(event.updated);
    if (!isValid(date)) return;
    
    let period: string;
    
    if (isToday(date)) {
      period = 'Today';
    } else if (isYesterday(date)) {
      period = 'Yesterday';
    } else if (isThisWeek(date)) {
      period = 'This Week';
    } else {
      period = format(date, 'MMMM yyyy');
    }
    
    if (!groups.has(period)) {
      groups.set(period, []);
    }
    groups.get(period)!.push(event);
  });
  
  return groups;
}
