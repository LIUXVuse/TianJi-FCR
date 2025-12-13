import React from 'react';

interface TianJiCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const TianJiCard: React.FC<TianJiCardProps> = ({ title, children, className = '', icon }) => {
  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl shadow-lg overflow-hidden ${className}`}>
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        {icon && <span className="text-cyan-400">{icon}</span>}
        <h3 className="text-lg font-bold text-gray-100 tracking-wide">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};
