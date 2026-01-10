import React from 'react';
import { useTheme, frameClasses, frameInnerClasses } from '@/theme';

interface ExhibitFrameProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function ExhibitFrame({ children, className = '', size = 'md' }: ExhibitFrameProps) {
  const { theme } = useTheme();
  const padding = size === 'sm' ? 'p-2' : 'p-3';
  const outerRadius = size === 'sm' ? 'rounded' : 'rounded-md';
  const innerRadius = size === 'sm' ? 'rounded-sm' : 'rounded';

  return (
    <div
      className={`
        border transition-all duration-200
        hover:-translate-y-0.5
        ${frameClasses[theme]}
        ${padding}
        ${outerRadius}
        ${className}
      `}
    >
      <div className={`overflow-hidden ${frameInnerClasses[theme]} ${innerRadius}`}>{children}</div>
    </div>
  );
}
