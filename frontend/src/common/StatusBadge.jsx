import React from 'react';
import { getStatusColor, capitalize } from '../utils/helpers';

const StatusBadge = ({ status, size = 'sm', showDot = false }) => {
  const colorClass = getStatusColor(status);
  const sizeClass = size === 'xs' ? 'text-xs px-2 py-0.5' : size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
      )}
      {capitalize(status?.replace(/_/g, ' ') || '')}
    </span>
  );
};

export default StatusBadge;
