/**
 * StatusBadge Component
 * Displays colored badges for job statuses
 */

import React from 'react';
import type { JobStatus } from '../../types';

interface StatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const statusConfig: Record<
  JobStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: 'Pending',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  },
  running: {
    label: 'Running',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  success: {
    label: 'Success',
    bgColor: 'bg-success-100',
    textColor: 'text-success-700',
  },
  failed: {
    label: 'Failed',
    bgColor: 'bg-error-100',
    textColor: 'text-error-700',
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: 'bg-warning-100',
    textColor: 'text-warning-700',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
    >
      {config.label}
    </span>
  );
};
