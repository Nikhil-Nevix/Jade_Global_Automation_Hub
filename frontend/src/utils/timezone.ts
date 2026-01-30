/**
 * Timezone Utilities
 * Functions for handling timezone conversions and formatting
 */

// Common timezones for dropdown
export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'EST (Eastern Time)' },
  { value: 'America/Chicago', label: 'CST (Central Time)' },
  { value: 'America/Denver', label: 'MST (Mountain Time)' },
  { value: 'America/Los_Angeles', label: 'PST (Pacific Time)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'Europe/Paris', label: 'CET (Paris)' },
  { value: 'Europe/Berlin', label: 'CET (Berlin)' },
  { value: 'Asia/Dubai', label: 'GST (Dubai)' },
  { value: 'Asia/Kolkata', label: 'IST (India)' },
  { value: 'Asia/Shanghai', label: 'CST (China)' },
  { value: 'Asia/Tokyo', label: 'JST (Japan)' },
  { value: 'Asia/Singapore', label: 'SGT (Singapore)' },
  { value: 'Australia/Sydney', label: 'AEDT (Sydney)' },
];

/**
 * Format a date string according to user's timezone
 * @param dateString - ISO date string from backend
 * @param timezone - IANA timezone string (e.g., 'America/New_York', 'Asia/Kolkata')
 * @param format - 'full' | 'date' | 'time' | 'datetime'
 * @returns Formatted date string
 */
export function formatWithTimezone(
  dateString: string | null | undefined,
  timezone: string = 'UTC',
  format: 'full' | 'date' | 'time' | 'datetime' = 'datetime'
): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
    };

    // Configure format options
    switch (format) {
      case 'full':
        options.dateStyle = 'full';
        options.timeStyle = 'long';
        break;
      case 'date':
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        options.hour12 = false;
        break;
      case 'datetime':
      default:
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = false;
        break;
    }

    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    return dateString;
  }
}

/**
 * Get user's timezone from localStorage or default to UTC
 */
export function getUserTimezone(): string {
  return localStorage.getItem('userTimezone') || 'UTC';
}

/**
 * Save user's timezone to localStorage
 */
export function setUserTimezone(timezone: string): void {
  localStorage.setItem('userTimezone', timezone);
}

/**
 * Format date for display with two lines (date + time)
 * @param dateString - ISO date string from backend
 * @param timezone - IANA timezone string
 * @returns Object with date and time strings
 */
export function formatDateTimeTwoLine(
  dateString: string | null | undefined,
  timezone: string = 'UTC'
): { date: string; time: string } {
  if (!dateString) {
    return { date: 'N/A', time: '' };
  }

  const date = formatWithTimezone(dateString, timezone, 'date');
  const time = formatWithTimezone(dateString, timezone, 'time');

  return { date, time };
}

/**
 * Get relative time with timezone awareness
 * @param dateString - ISO date string from backend
 * @param timezone - IANA timezone string
 * @returns Relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(
  dateString: string | null | undefined,
  timezone: string = 'UTC'
): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    // For older dates, show formatted date
    return formatWithTimezone(dateString, timezone, 'date');
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return dateString;
  }
}
