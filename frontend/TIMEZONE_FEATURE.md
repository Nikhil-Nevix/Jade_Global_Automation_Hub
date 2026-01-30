# Timezone Feature Implementation

## Overview
Added user-specific timezone preference system that allows each user to customize how dates and times are displayed throughout the application.

## Features Implemented

### 1. Backend Changes

#### Database Migration
- **File**: `backend/migrations/add_user_timezone.sql`
- **Changes**: Added `timezone` column to `users` table
  - Type: VARCHAR(50)
  - Default: 'UTC'
  - Not Null

#### User Model Update
- **File**: `backend/app/models.py`
- **Changes**: Added `timezone` field to User model

#### API Endpoint
- **File**: `backend/app/api/users.py`
- **Endpoint**: `PATCH /users/me/timezone`
- **Authentication**: JWT required
- **Request Body**:
  ```json
  {
    "timezone": "America/New_York"
  }
  ```
- **Response**: Updated user object with new timezone

### 2. Frontend Changes

#### Type Definition
- **File**: `frontend/src/types/index.ts`
- **Changes**: Added `timezone: string` to User interface

#### Timezone Utilities
- **File**: `frontend/src/utils/timezone.ts`
- **Functions**:
  - `formatWithTimezone(dateString, timezone, format)` - Format dates in user's timezone
  - `getUserTimezone()` - Get timezone from localStorage
  - `setUserTimezone(timezone)` - Save timezone to localStorage
  - `formatDateTimeTwoLine(dateString, timezone)` - Format date and time on separate lines
  - `getRelativeTime(dateString, timezone)` - Get relative time (e.g., "2 hours ago")
- **Constants**:
  - `COMMON_TIMEZONES` - Array of commonly used timezones with labels

#### API Integration
- **File**: `frontend/src/api/api.ts`
- **Changes**: Added `updateTimezone` method to `usersApi`

#### Settings Page UI
- **File**: `frontend/src/pages/SettingsPage/SettingsPage.tsx`
- **Changes**:
  - Added timezone dropdown in General Settings tab
  - Integrated with user profile and localStorage
  - Added save functionality with loading state
  - Initializes timezone from user profile on mount

## Supported Timezones

The following timezones are available in the dropdown:
- UTC (Coordinated Universal Time)
- EST (America/New_York - Eastern Time)
- CST (America/Chicago - Central Time)
- MST (America/Denver - Mountain Time)
- PST (America/Los_Angeles - Pacific Time)
- GMT (Europe/London)
- CET (Europe/Paris, Europe/Berlin)
- GST (Asia/Dubai)
- IST (Asia/Kolkata - India)
- CST (Asia/Shanghai - China)
- JST (Asia/Tokyo - Japan)
- SGT (Asia/Singapore)
- AEDT (Australia/Sydney)

## How It Works

1. **User Selection**: User selects their preferred timezone from dropdown in Settings > General
2. **Local Storage**: Timezone is saved to browser's localStorage for immediate use
3. **Backend Sync**: Timezone is sent to backend and saved in database
4. **State Update**: Auth store is updated with new user data
5. **Display**: All date/time displays can use the utility functions to show times in user's timezone

## Usage Examples

### Formatting a Date
```typescript
import { formatWithTimezone } from '../utils/timezone';

// Full format
const fullDate = formatWithTimezone('2024-01-28T10:30:00Z', 'America/New_York', 'full');
// Output: "Sunday, January 28, 2024 at 5:30:00 AM EST"

// Date only
const dateOnly = formatWithTimezone('2024-01-28T10:30:00Z', 'Asia/Kolkata', 'date');
// Output: "Jan 28, 2024"

// Time only
const timeOnly = formatWithTimezone('2024-01-28T10:30:00Z', 'Europe/London', 'time');
// Output: "10:30:00"

// Date and time (default)
const dateTime = formatWithTimezone('2024-01-28T10:30:00Z', 'UTC');
// Output: "Jan 28, 2024, 10:30"
```

### Two-Line Format
```typescript
import { formatDateTimeTwoLine } from '../utils/timezone';

const { date, time } = formatDateTimeTwoLine('2024-01-28T10:30:00Z', 'Asia/Kolkata');
// date: "Jan 28, 2024"
// time: "16:00:00"

// Use in JSX:
<div>
  <div>{date}</div>
  <div className="text-sm text-gray-500">{time}</div>
</div>
```

### Relative Time
```typescript
import { getRelativeTime } from '../utils/timezone';

const relative = getRelativeTime('2024-01-28T10:00:00Z', 'UTC');
// If current time is 10:30, output: "30 minutes ago"
// If current time is next day, output: "1 day ago"
// If older than 7 days, shows formatted date
```

## Next Steps (Optional Enhancements)

To fully integrate timezone support across the application, update the following pages:

1. **Dashboard** (`DashboardPage.tsx`)
   - Update recent jobs table to use `formatDateTimeTwoLine`
   
2. **Jobs Page** (`JobsPage.tsx`)
   - Already shows date+time, can enhance with timezone utilities
   
3. **Job Details** (`JobDetailsPage.tsx`)
   - Update Created, Started, Ended times with timezone formatting
   
4. **Servers Page** (`ServersPage.tsx`)
   - Update last_seen timestamps
   
5. **Audit Logs** (`PlaybookAuditPage.tsx`, `PlaybookAuditLogsPage.tsx`)
   - Already shows timestamps, can enhance with timezone

6. **User Management** (`UsersPage.tsx`)
   - Update created_at, last_login times

## Testing

1. Login to the application
2. Navigate to Settings > General
3. Select a different timezone from the dropdown
4. Click "Save Preferences"
5. Verify the alert shows "Timezone preference saved successfully!"
6. Refresh the page - selected timezone should persist
7. Check browser's localStorage for 'userTimezone' key
8. Verify database `users` table has updated timezone value

## Database Verification

```sql
-- Check timezone values in database
SELECT id, username, timezone FROM users;

-- Update timezone manually (if needed)
UPDATE users SET timezone = 'America/New_York' WHERE id = 1;
```

## Notes

- Timezone preference is per-user, not system-wide
- Stored in both database (persistent) and localStorage (fast access)
- Display-only feature - does not affect backend job scheduling
- Uses IANA timezone database format (e.g., 'America/New_York')
- All users can change their timezone preference (not restricted to admins)
