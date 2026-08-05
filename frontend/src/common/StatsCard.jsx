import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = 'bg-primary-100',
  iconColor = 'text-primary-600',
  trend,
  trendLabel,
  className = '',
  onClick,
}) => {
  const isPositive = trend > 0;
  const isNegative = trend < 0;
  const isNeutral = trend === 0 || trend === undefined || trend === null;

  return (
    <div
      className={`bg-white rounded-xl p-6 shadow-sm border border-slate-100 card-hover ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          {(trend !== undefined && trend !== null) && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
              {isNegative && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
              {isNeutral && <Minus className="w-3.5 h-3.5 text-slate-400" />}
              <span
                className={`text-xs font-medium ${
                  isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-400'
                }`}
              >
                {isPositive ? '+' : ''}{trend}%
              </span>
              {trendLabel && <span className="text-xs text-slate-400">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
