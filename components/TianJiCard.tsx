import React from 'react';

interface TianJiCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  accentColor?: 'cyan' | 'green' | 'red' | 'yellow' | 'purple' | 'orange';
  headerRight?: React.ReactNode;
}

const accentColors = {
  cyan: 'text-cyan-400',
  green: 'text-green-400',
  red: 'text-red-400',
  yellow: 'text-yellow-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
};

export const TianJiCard: React.FC<TianJiCardProps> = ({
  title,
  children,
  className = '',
  icon,
  accentColor = 'cyan',
  headerRight
}) => {
  const colorClass = accentColors[accentColor] || accentColors.cyan;

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl shadow-lg overflow-hidden ${className}`}>
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className={colorClass}>{icon}</span>}
          <h3 className="text-lg font-bold text-gray-100 tracking-wide">{title}</h3>
        </div>
        {headerRight && <div>{headerRight}</div>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};
