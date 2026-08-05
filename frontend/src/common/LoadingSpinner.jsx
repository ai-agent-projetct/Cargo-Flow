import React from 'react';

const LoadingSpinner = ({ size = 'md', text = '', fullScreen = false, className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4',
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizes[size]} border-primary-200 border-t-primary-600 rounded-full animate-spin`}
        style={{ borderWidth: size === 'sm' ? '2px' : size === 'md' ? '3px' : '4px' }}
      />
      {text && <p className="text-sm text-slate-500 font-medium">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export const PageLoader = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center h-64">
    <LoadingSpinner size="lg" text={text} />
  </div>
);

export default LoadingSpinner;
